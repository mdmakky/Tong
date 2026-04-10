-- CreateTable
CREATE TABLE "user_nicknames" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "conversation_type" VARCHAR(50) NOT NULL,
    "nickname" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_nicknames_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_nicknames_user_id_conversation_id_conversation_type_key" ON "user_nicknames"("user_id", "conversation_id", "conversation_type");

-- CreateIndex
CREATE INDEX "user_nicknames_conversation_id_idx" ON "user_nicknames"("conversation_id");

-- CreateIndex
CREATE INDEX "user_nicknames_conversation_type_idx" ON "user_nicknames"("conversation_type");

-- AddForeignKey
ALTER TABLE "user_nicknames" ADD CONSTRAINT "user_nicknames_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
