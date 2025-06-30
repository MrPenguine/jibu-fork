-- AddForeignKey
ALTER TABLE "Assistant" ADD CONSTRAINT "Assistant_n8nWorkflowId_fkey" FOREIGN KEY ("n8nWorkflowId") REFERENCES "N8nWorkflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
