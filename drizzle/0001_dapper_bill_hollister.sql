CREATE TYPE "public"."membership_role" AS ENUM('OWNER', 'MANAGER', 'CASHIER');--> statement-breakpoint
CREATE TABLE "tenant_memberships" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"user_id" varchar(36),
	"invited_email" varchar(191),
	"role" "membership_role" DEFAULT 'CASHIER' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "tenant_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "created_by" varchar(36);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "updated_by" varchar(36);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "created_by" varchar(36);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "updated_by" varchar(36);--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_membership_tenant" ON "tenant_memberships" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_membership_user" ON "tenant_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_membership_email" ON "tenant_memberships" USING btree ("invited_email");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_membership_tenant_user" ON "tenant_memberships" USING btree ("tenant_id","user_id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;