/*
  Warnings:

  - You are about to drop the column `parentEmail` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `parentName` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `parentPhone` on the `students` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `students` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[parentUserId]` on the table `students` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `students` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "students" DROP COLUMN "parentEmail",
DROP COLUMN "parentName",
DROP COLUMN "parentPhone",
ADD COLUMN     "parentUserId" TEXT,
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "students_userId_key" ON "students"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "students_parentUserId_key" ON "students"("parentUserId");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
