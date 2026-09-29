CREATE TYPE "public"."user_role" AS ENUM('OWNER', 'STAFF');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('sale', 'sale_reversal', 'purchase', 'adjustment', 'return');--> statement-breakpoint
CREATE TYPE "public"."customer_ledger_entry_type" AS ENUM('credit_sale', 'payment_received', 'adjustment', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."bill_charge_type" AS ENUM('labour', 'service', 'installation', 'delivery', 'other');--> statement-breakpoint
CREATE TYPE "public"."bill_status" AS ENUM('completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'partial', 'paid', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'UPI', 'CARD', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."payment_record_status" AS ENUM('completed', 'reversed');--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"sku_prefix" varchar(10) NOT NULL,
	"next_sku_seq" integer DEFAULT 1 NOT NULL,
	"invoice_prefix" varchar(10) DEFAULT 'INV-' NOT NULL,
	"next_invoice_seq" integer DEFAULT 1 NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"tax_enabled" boolean DEFAULT false NOT NULL,
	"default_tax_rate" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"provider_id" varchar(50) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(191) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"tenant_id" varchar(36) NOT NULL,
	"role" "user_role" DEFAULT 'STAFF' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"value" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"sku" varchar(30) NOT NULL,
	"name" varchar(191) NOT NULL,
	"image_url" varchar(500),
	"stock_quantity" numeric(12, 3) DEFAULT '0.000' NOT NULL,
	"unit" varchar(20) DEFAULT 'unit' NOT NULL,
	"selling_price" bigint NOT NULL,
	"purchase_price" bigint DEFAULT 0 NOT NULL,
	"low_stock_threshold" numeric(12, 3),
	"features" text,
	"category" varchar(50),
	"barcode" varchar(64),
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"product_id" varchar(36) NOT NULL,
	"quantity_delta" numeric(12, 3) NOT NULL,
	"balance_after" numeric(12, 3) NOT NULL,
	"movement_type" "movement_type" NOT NULL,
	"reference_id" varchar(36),
	"reason" varchar(255),
	"created_by" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_ledger_entries" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"customer_id" varchar(36) NOT NULL,
	"entry_type" "customer_ledger_entry_type" NOT NULL,
	"amount" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"bill_id" varchar(36),
	"payment_id" varchar(36),
	"notes" varchar(255),
	"created_by" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"name" varchar(150) NOT NULL,
	"phone" varchar(20),
	"email" varchar(191),
	"address" text,
	"receivable_balance" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_charges" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"bill_id" varchar(36) NOT NULL,
	"charge_type" "bill_charge_type" NOT NULL,
	"description" varchar(150),
	"amount" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_items" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"bill_id" varchar(36) NOT NULL,
	"product_id" varchar(36) NOT NULL,
	"product_name" varchar(191) NOT NULL,
	"sku" varchar(30) NOT NULL,
	"unit" varchar(20) NOT NULL,
	"unit_price" bigint NOT NULL,
	"purchase_price" bigint NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"line_discount" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"bill_number" varchar(30) NOT NULL,
	"customer_id" varchar(36),
	"status" "bill_status" DEFAULT 'completed' NOT NULL,
	"payment_status" "payment_status" NOT NULL,
	"items_subtotal" bigint NOT NULL,
	"charges_total" bigint DEFAULT 0 NOT NULL,
	"discount_total" bigint DEFAULT 0 NOT NULL,
	"tax_total" bigint DEFAULT 0 NOT NULL,
	"grand_total" bigint NOT NULL,
	"paid_amount" bigint DEFAULT 0 NOT NULL,
	"due_amount" bigint DEFAULT 0 NOT NULL,
	"created_by" varchar(36) NOT NULL,
	"idempotency_key" varchar(64) NOT NULL,
	"cancelled_at" timestamp,
	"cancelled_by" varchar(36),
	"cancel_reason" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"bill_id" varchar(36) NOT NULL,
	"customer_id" varchar(36),
	"amount" bigint NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "payment_record_status" DEFAULT 'completed' NOT NULL,
	"reference_note" varchar(100),
	"reversed_at" timestamp,
	"reversed_by" varchar(36),
	"reversal_reason" varchar(255),
	"created_by" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_items" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"purchase_id" varchar(36) NOT NULL,
	"product_id" varchar(36) NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_cost" bigint NOT NULL,
	"total_cost" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"supplier_id" varchar(36),
	"reference_invoice" varchar(50),
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"name" varchar(150) NOT NULL,
	"phone" varchar(20),
	"email" varchar(191),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"action" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(36) NOT NULL,
	"metadata_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_ledger_entries" ADD CONSTRAINT "customer_ledger_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_ledger_entries" ADD CONSTRAINT "customer_ledger_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_ledger_entries" ADD CONSTRAINT "customer_ledger_entries_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_charges" ADD CONSTRAINT "bill_charges_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_charges" ADD CONSTRAINT "bill_charges_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_cancelled_by_user_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reversed_by_user_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_account_user" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_session_user" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_tenant" ON "user" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tenant_sku" ON "products" USING btree ("tenant_id","sku");--> statement-breakpoint
CREATE INDEX "idx_tenant_product_lookup" ON "products" USING btree ("tenant_id","status","name");--> statement-breakpoint
CREATE INDEX "idx_tenant_barcode" ON "products" USING btree ("tenant_id","barcode");--> statement-breakpoint
CREATE INDEX "idx_movements_tenant_product" ON "stock_movements" USING btree ("tenant_id","product_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ledger_tenant_cust" ON "customer_ledger_entries" USING btree ("tenant_id","customer_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_customer_tenant_phone" ON "customers" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE INDEX "idx_customer_tenant_name" ON "customers" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "idx_bill_charges_bill" ON "bill_charges" USING btree ("tenant_id","bill_id");--> statement-breakpoint
CREATE INDEX "idx_bill_items_bill" ON "bill_items" USING btree ("tenant_id","bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tenant_bill_number" ON "bills" USING btree ("tenant_id","bill_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tenant_idempotency" ON "bills" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_tenant_bills_created" ON "bills" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payments_tenant_bill" ON "payments" USING btree ("tenant_id","bill_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_items_purchase" ON "purchase_items" USING btree ("tenant_id","purchase_id");--> statement-breakpoint
CREATE INDEX "idx_purchases_tenant" ON "purchases" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_suppliers_tenant" ON "suppliers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_audit_tenant_action" ON "audit_logs" USING btree ("tenant_id","action","created_at");