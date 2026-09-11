-- A missing quantity must not prevent storing a verified parent-child relationship.
ALTER TABLE product_bom_items ALTER COLUMN quantity DROP NOT NULL;
