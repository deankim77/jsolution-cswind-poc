-- Data-only migration: keep extraction JSON, BOM edges, names and costs intact.
-- Other product databases must never receive this CS WIND sample mapping.
DO $$
BEGIN
 IF current_database() <> 'jsolution_cswind_poc' THEN
  RAISE EXCEPTION 'Item Description SPEC migration requires jsolution_cswind_poc';
 END IF;
 LOCK TABLE product_parts, customer_part_identities, customer_confirmed_data, bom_edit_locks, production_bulk_locks IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS (SELECT 1 FROM bom_edit_locks) OR EXISTS (SELECT 1 FROM production_bulk_locks) THEN
  RAISE EXCEPTION 'Finish BOM edits before migrating specifications';
 END IF;
END $$;
--> statement-breakpoint
WITH latest AS (
 SELECT company_id, project_id, record_id, max(version) AS version
 FROM customer_confirmed_data WHERE item->>'area' = 'pbom'
 GROUP BY company_id, project_id, record_id
), candidates AS (
 SELECT DISTINCT p.id, p.company_id, p.spec AS old_spec,
   trim(c.item->'bom'->>'itemDescription') AS new_spec,
   coalesce(trim(c.item->'bom'->>'material'), '') AS old_material
 FROM customer_confirmed_data c
 JOIN latest l USING (company_id, project_id, record_id, version)
 JOIN customer_part_identities i ON i.company_id = c.company_id AND i.project_id = c.project_id
   AND i.customer_key = 'APPROVED:' || c.record_id || ':' || (c.item->>'id')
 JOIN product_parts p ON p.id = i.part_id AND p.company_id = i.company_id
 WHERE c.item->>'area' = 'pbom'
   AND nullif(trim(c.item->'bom'->>'itemDescription'), '') IS NOT NULL
), eligible AS (
 SELECT id, company_id, min(new_spec) AS new_spec
 FROM candidates
 GROUP BY id, company_id
 HAVING count(DISTINCT new_spec) = 1
   AND bool_and(coalesce(trim(old_spec), '') = '' OR trim(old_spec) = old_material)
), changed AS (
 UPDATE product_parts p SET spec = e.new_spec,
   updated_at = extract(epoch FROM now())::integer
 FROM eligible e WHERE p.id = e.id AND p.company_id = e.company_id
   AND p.spec IS DISTINCT FROM e.new_spec
 RETURNING p.id, p.company_id, p.spec
)
INSERT INTO audit_logs (id, company_id, action, entity_type, entity_id, detail, created_at)
SELECT gen_random_uuid()::text, ch.company_id, 'CSWIND_SPEC_BACKFILLED', 'PART', ch.id,
 jsonb_build_object('migration', '0015_cswind_item_description_spec',
   'oldSpec', (SELECT c.old_spec FROM candidates c WHERE c.id = ch.id LIMIT 1),
   'newSpec', ch.spec)::text,
 extract(epoch FROM now())::integer
FROM changed ch;
