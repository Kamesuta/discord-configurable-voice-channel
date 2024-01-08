-- CreateTable
CREATE TABLE `BlackLists` (
    `register_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(191) NOT NULL,
    `block_user_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`register_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
