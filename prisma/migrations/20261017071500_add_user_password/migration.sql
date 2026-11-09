-- Add credentials-auth password hash to User.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
