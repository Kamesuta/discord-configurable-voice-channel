-- CreateTable
CREATE TABLE "BlackLists" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "block_user_id" TEXT NOT NULL,

    CONSTRAINT "BlackLists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomLists" (
    "id" BIGSERIAL NOT NULL,
    "channel_id" TEXT NOT NULL,
    "wait_channel_id" TEXT,

    CONSTRAINT "RoomLists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomLists_channel_id_key" ON "RoomLists"("channel_id");

