ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'planned';
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS document_kind text NOT NULL DEFAULT 'document';
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS drawing_code text;
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS drawing_company_id text;
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS drawing_type text;
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS internal_drawing_number text;
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS customer_drawing_number text;
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS owner_department text;
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS owner_user_id text;
ALTER TABLE deliverables ADD COLUMN origin text NOT NULL DEFAULT 'internal';
ALTER TABLE deliverables ADD CONSTRAINT deliverables_origin_ck CHECK (origin IN ('customer','internal'));
ALTER TABLE deliverable_versions ADD COLUMN source_document_number text;
ALTER TABLE deliverable_versions ADD COLUMN source_revision text;
ALTER TABLE deliverable_versions ADD COLUMN source_drawing_number text;
ALTER TABLE deliverable_versions ADD COLUMN document_type text;
ALTER TABLE customer_raw_data ADD COLUMN deliverable_id text REFERENCES deliverables(id) ON DELETE RESTRICT;
ALTER TABLE customer_raw_data ADD COLUMN deliverable_version_id text REFERENCES deliverable_versions(id) ON DELETE RESTRICT;
--> statement-breakpoint
-- Keep source IDs, binaries, and all AI/BOM/TRR references intact. Never match by file name.
DO $$
DECLARE g record; r record; v record; d text; n integer; kind text; code text; seq integer; yr integer;
BEGIN
 FOR g IN SELECT project_id,raw_data_id FROM customer_raw_data GROUP BY project_id,raw_data_id LOOP
  SELECT count(DISTINCT dv.deliverable_id),min(dv.deliverable_id) INTO n,d
    FROM customer_raw_data cr JOIN deliverable_versions dv ON dv.project_id=cr.project_id AND dv.file_key=cr.file_key AND dv.deleted_at IS NULL
    WHERE cr.project_id=g.project_id AND cr.raw_data_id=g.raw_data_id;
  IF n>1 THEN RAISE EXCEPTION 'Customer document has conflicting existing deliverables: %',g.raw_data_id; END IF;
  IF d IS NULL THEN
   d := 'customer-document-' || md5(g.project_id || ':' || g.raw_data_id);
   SELECT * INTO r FROM customer_raw_data WHERE project_id=g.project_id AND raw_data_id=g.raw_data_id ORDER BY revision DESC LIMIT 1;
   INSERT INTO deliverables(id,project_id,name,required,status,source,origin,file_key,version,created_by,created_at,updated_at)
     VALUES(d,g.project_id,r.title,0,'submitted','ad_hoc','customer',r.file_key,'Rev.'||lpad(r.revision::text,2,'0'),r.created_by,r.created_at,r.created_at);
  ELSE
   UPDATE deliverables SET origin='customer' WHERE id=d;
  END IF;
  FOR r IN SELECT * FROM customer_raw_data WHERE project_id=g.project_id AND raw_data_id=g.raw_data_id ORDER BY revision LOOP
   SELECT * INTO v FROM deliverable_versions WHERE project_id=g.project_id AND deliverable_id=d AND file_key=r.file_key AND deleted_at IS NULL ORDER BY revision DESC LIMIT 1;
   IF NOT FOUND THEN
    SELECT coalesce(max(revision),0)+1 INTO n FROM deliverable_versions WHERE deliverable_id=d;
    INSERT INTO deliverable_versions(id,project_id,deliverable_id,revision,file_key,file_name,file_size,content_type,note,created_by,created_at)
      VALUES('customer-version-'||r.id,g.project_id,d,n,r.file_key,r.file_name,r.file_size,
       CASE lower(substring(r.file_name from '\.[^.]+$')) WHEN '.pdf' THEN 'application/pdf' WHEN '.png' THEN 'image/png' WHEN '.jpg' THEN 'image/jpeg' WHEN '.jpeg' THEN 'image/jpeg' WHEN '.xlsx' THEN 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ELSE 'application/octet-stream' END,
       r.note,r.created_by,r.created_at) RETURNING * INTO v;
   END IF;
   UPDATE customer_raw_data SET deliverable_id=d,deliverable_version_id=v.id WHERE id=r.id;
   UPDATE deliverable_versions dv SET document_type=cr.draft->>'documentType',source_document_number=nullif(cr.draft->>'drawingNumber',''),source_revision=nullif(cr.draft->>'revisionLabel','')
    FROM customer_reviews cr WHERE dv.id=v.id AND cr.record_id=r.id AND cr.draft->>'documentTypeConfirmed'='true';
  END LOOP;
  SELECT * INTO v FROM deliverable_versions WHERE deliverable_id=d AND deleted_at IS NULL ORDER BY revision DESC LIMIT 1;
  kind := CASE WHEN v.document_type IS NULL THEN (SELECT document_kind FROM deliverables WHERE id=d) WHEN v.document_type='drawing' THEN 'drawing' ELSE 'document' END;
  code := NULL;
  IF kind='drawing' THEN
   SELECT drawing_code INTO code FROM deliverables WHERE id=d;
   IF code IS NULL THEN
    yr:=extract(year from current_date)::integer;
    INSERT INTO drawing_code_sequences(company_id,issue_year,next_value) VALUES(r.company_id,yr,1) ON CONFLICT DO NOTHING;
    UPDATE drawing_code_sequences SET next_value=next_value+1 WHERE company_id=r.company_id AND issue_year=yr RETURNING next_value-1 INTO seq;
    code:='DWG-'||yr||'-'||lpad(seq::text,6,'0');
   END IF;
  END IF;
  UPDATE deliverables SET file_key=v.file_key,version='Rev.'||lpad(v.revision::text,2,'0'),document_kind=kind,
   drawing_code=coalesce(code,drawing_code),drawing_company_id=CASE WHEN kind='drawing' THEN r.company_id ELSE drawing_company_id END,
   category=CASE WHEN kind='drawing' THEN 'DESIGN_DRAWING' ELSE category END,
   customer_drawing_number=CASE WHEN kind='drawing' THEN (SELECT nullif(draft->>'drawingNumber','') FROM customer_reviews WHERE record_id=r.id) ELSE customer_drawing_number END
   WHERE id=d;
 END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE customer_raw_data ALTER COLUMN deliverable_id SET NOT NULL;
ALTER TABLE customer_raw_data ALTER COLUMN deliverable_version_id SET NOT NULL;
CREATE UNIQUE INDEX customer_raw_data_document_version_uq ON customer_raw_data(deliverable_version_id);
CREATE INDEX customer_raw_data_document_idx ON customer_raw_data(deliverable_id);
CREATE INDEX deliverables_project_origin_idx ON deliverables(project_id,origin);
