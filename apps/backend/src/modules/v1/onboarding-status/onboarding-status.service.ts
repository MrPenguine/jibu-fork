import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { UpdateOnboardingStatusDto } from './dto/update-onboarding-status.dto';
// Import Prisma types correctly
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

// Define the OnboardingStatus type based on the Prisma schema
type OnboardingStatus = {
  id: string;
  userId: string;
  version: number;
  createdAgent: boolean;
  addedTool: boolean;
  addedPhoneNumber: boolean;
  ranTest: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class OnboardingStatusService {
  private readonly logger = new Logger(OnboardingStatusService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the onboarding status for a user
   * @param userId The user ID
   * @returns The onboarding status
   */
  async getStatus(userId: string): Promise<OnboardingStatus> {
    try {
      // Try to find existing status
      const status = await this.prisma.$queryRaw<OnboardingStatus[]>
        `SELECT * FROM "OnboardingStatus" WHERE "userId" = ${userId} LIMIT 1`;

      // If status exists, return it
      if (status && status.length > 0) {
        return status[0];
      }

      // If no status exists, create a new one with default values
      const newStatus = await this.prisma.$executeRaw
        `INSERT INTO "OnboardingStatus" ("id", "userId", "version", "createdAgent", "addedTool", "addedPhoneNumber", "ranTest", "createdAt", "updatedAt") 
         VALUES (${randomUUID()}, ${userId}, 1, false, false, false, false, NOW(), NOW()) 
         RETURNING *`;
      
      // Fetch the newly created status
      return this.getStatus(userId);
    } catch (error) {
      this.logger.error(`Error getting onboarding status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update the onboarding status for a user
   * @param userId The user ID
   * @param updateDto The update data
   * @returns The updated onboarding status
   */
  async updateStatus(userId: string, updateDto: UpdateOnboardingStatusDto): Promise<OnboardingStatus> {
    try {
      // Check if status exists
      const existingStatus = await this.prisma.$queryRaw<OnboardingStatus[]>
        `SELECT * FROM "OnboardingStatus" WHERE "userId" = ${userId} LIMIT 1`;

      if (!existingStatus || existingStatus.length === 0) {
        // Create new status with provided values
        const createdAgent = updateDto.createdAgent ?? false;
        const addedTool = updateDto.addedTool ?? false;
        const addedPhoneNumber = updateDto.addedPhoneNumber ?? false;
        const ranTest = updateDto.ranTest ?? false;
        
        await this.prisma.$executeRaw
          `INSERT INTO "OnboardingStatus" ("id", "userId", "version", "createdAgent", "addedTool", "addedPhoneNumber", "ranTest", "createdAt", "updatedAt") 
           VALUES (${randomUUID()}, ${userId}, 1, ${createdAgent}, ${addedTool}, ${addedPhoneNumber}, ${ranTest}, NOW(), NOW())`;
        
        return this.getStatus(userId);
      }

      // Update existing status
      const setClause = [];
      const params = [];
      
      if (updateDto.createdAgent !== undefined) {
        setClause.push(`"createdAgent" = ${updateDto.createdAgent}`);
      }
      if (updateDto.addedTool !== undefined) {
        setClause.push(`"addedTool" = ${updateDto.addedTool}`);
      }
      if (updateDto.addedPhoneNumber !== undefined) {
        setClause.push(`"addedPhoneNumber" = ${updateDto.addedPhoneNumber}`);
      }
      if (updateDto.ranTest !== undefined) {
        setClause.push(`"ranTest" = ${updateDto.ranTest}`);
      }
      
      if (setClause.length > 0) {
        await this.prisma.$executeRaw
          `UPDATE "OnboardingStatus" SET ${Prisma.raw(setClause.join(', '))}, "updatedAt" = NOW() WHERE "userId" = ${userId}`;
      }
      
      return this.getStatus(userId);
    } catch (error) {
      this.logger.error(`Error updating onboarding status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reset the onboarding status for a user
   * @param userId The user ID
   * @returns The reset onboarding status
   */
  async resetStatus(userId: string): Promise<OnboardingStatus> {
    try {
      // Check if status exists
      const existingStatus = await this.prisma.$queryRaw<OnboardingStatus[]>
        `SELECT * FROM "OnboardingStatus" WHERE "userId" = ${userId} LIMIT 1`;

      if (!existingStatus || existingStatus.length === 0) {
        throw new NotFoundException(`Onboarding status not found for user ${userId}`);
      }

      // Reset all flags to false but increment version
      const newVersion = existingStatus[0].version + 1;
      await this.prisma.$executeRaw
        `UPDATE "OnboardingStatus" 
         SET "version" = ${newVersion}, 
             "createdAgent" = false, 
             "addedTool" = false, 
             "addedPhoneNumber" = false, 
             "ranTest" = false, 
             "updatedAt" = NOW() 
         WHERE "userId" = ${userId}`;
      
      return this.getStatus(userId);
    } catch (error) {
      this.logger.error(`Error resetting onboarding status: ${error.message}`);
      throw error;
    }
  }
}
