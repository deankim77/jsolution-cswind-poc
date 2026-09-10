CREATE TABLE customer_reviews (
 record_id text PRIMARY KEY, company_id text NOT NULL, project_id text NOT NULL,
 version integer NOT NULL CHECK(version>0), draft jsonb NOT NULL, messages jsonb NOT NULL,
 updated_by text NOT NULL REFERENCES users(id), updated_at integer NOT NULL,
 FOREIGN KEY(company_id,project_id,record_id) REFERENCES customer_raw_data(company_id,project_id,id)
);
CREATE TABLE customer_confirmed_data (
 id text PRIMARY KEY, company_id text NOT NULL, project_id text NOT NULL, record_id text NOT NULL,
 version integer NOT NULL, item_id text NOT NULL, item jsonb NOT NULL,
 confirmed_by text NOT NULL REFERENCES users(id), confirmed_at integer NOT NULL,
 FOREIGN KEY(company_id,project_id,record_id) REFERENCES customer_raw_data(company_id,project_id,id)
);
CREATE UNIQUE INDEX customer_confirmed_item_uq ON customer_confirmed_data(record_id,version,item_id);
