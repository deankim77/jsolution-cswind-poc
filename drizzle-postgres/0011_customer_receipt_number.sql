CREATE SEQUENCE customer_raw_data_receipt_seq;
--> statement-breakpoint
ALTER TABLE customer_raw_data ADD COLUMN receipt_number integer;
--> statement-breakpoint
WITH numbered AS (SELECT id, row_number() OVER (ORDER BY created_at, id)::integer AS n FROM customer_raw_data)
UPDATE customer_raw_data d SET receipt_number = n.n FROM numbered n WHERE d.id = n.id;
--> statement-breakpoint
SELECT setval('customer_raw_data_receipt_seq', COALESCE(MAX(receipt_number), 0) + 1, false) FROM customer_raw_data;
--> statement-breakpoint
ALTER TABLE customer_raw_data ALTER COLUMN receipt_number SET DEFAULT nextval('customer_raw_data_receipt_seq'), ALTER COLUMN receipt_number SET NOT NULL;
--> statement-breakpoint
ALTER SEQUENCE customer_raw_data_receipt_seq OWNED BY customer_raw_data.receipt_number;
--> statement-breakpoint
CREATE UNIQUE INDEX customer_raw_data_receipt_uq ON customer_raw_data(receipt_number);
