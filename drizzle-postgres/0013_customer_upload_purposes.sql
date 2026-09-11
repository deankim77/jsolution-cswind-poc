ALTER TABLE "customer_raw_data" DROP CONSTRAINT "customer_raw_data_purpose_ck";
--> statement-breakpoint
ALTER TABLE "customer_raw_data" ADD CONSTRAINT "customer_raw_data_purpose_ck" CHECK ("source_purpose" IN ('bom','ttr','input','template','example'));
