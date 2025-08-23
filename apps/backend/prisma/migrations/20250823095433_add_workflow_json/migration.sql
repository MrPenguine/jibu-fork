/*
  Warnings:

  - You are about to drop the column `edges` on the `Workflow` table. All the data in the column will be lost.
  - You are about to drop the column `nodes` on the `Workflow` table. All the data in the column will be lost.
  - You are about to drop the column `startNodeId` on the `Workflow` table. All the data in the column will be lost.
  - You are about to drop the `WorkflowEdge` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WorkflowNode` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `workflowJson` to the `Workflow` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."WorkflowEdge" DROP CONSTRAINT "WorkflowEdge_sourceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WorkflowEdge" DROP CONSTRAINT "WorkflowEdge_targetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WorkflowEdge" DROP CONSTRAINT "WorkflowEdge_workflowId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WorkflowNode" DROP CONSTRAINT "WorkflowNode_toolId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WorkflowNode" DROP CONSTRAINT "WorkflowNode_workflowId_fkey";

-- AlterTable
-- 1) Add as nullable first to allow backfill
ALTER TABLE "public"."Workflow" ADD COLUMN "workflowJson" JSONB;

-- 2) Backfill new JSON from legacy columns
UPDATE "public"."Workflow"
SET "workflowJson" = jsonb_build_object(
  'nodes', COALESCE("nodes", '[]'::jsonb),
  'edges', COALESCE("edges", '[]'::jsonb),
  'startNodeId', to_jsonb("startNodeId")
);

-- Ensure no nulls remain
UPDATE "public"."Workflow"
SET "workflowJson" = '{}'::jsonb
WHERE "workflowJson" IS NULL;

-- 3) Enforce NOT NULL constraint after data is present
ALTER TABLE "public"."Workflow" ALTER COLUMN "workflowJson" SET NOT NULL;

-- 4) Drop legacy columns after successful backfill
ALTER TABLE "public"."Workflow" DROP COLUMN "edges",
DROP COLUMN "nodes",
DROP COLUMN "startNodeId";

-- DropTable
DROP TABLE "public"."WorkflowEdge";

-- DropTable
DROP TABLE "public"."WorkflowNode";
