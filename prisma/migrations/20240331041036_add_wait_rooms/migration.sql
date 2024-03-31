-- CreateTable
CREATE TABLE `RoomLists` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `channel_id` VARCHAR(191) NOT NULL UNIQUE,
    `wait_channel_id` VARCHAR(191),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
