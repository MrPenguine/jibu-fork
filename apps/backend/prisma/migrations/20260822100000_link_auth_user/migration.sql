-- AddForeignKey
ALTER TABLE "public"."User"
ADD CONSTRAINT "auth_users_id_fkey"
FOREIGN KEY ("id") REFERENCES "public"."auth_users"("id")
ON DELETE CASCADE ON UPDATE CASCADE
NOT VALID;
