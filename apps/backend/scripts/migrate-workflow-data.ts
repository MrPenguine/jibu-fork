import { PrismaClient, WorkflowType } from '@prisma/client';

/**
 * This script migrates workflow data from Agent model to the new Workflow model.
 * It transfers nodes, edges, and other workflow properties while maintaining the relationships.
 */
async function main() {
  console.log('Starting workflow data migration...');
  const prisma = new PrismaClient();

  try {
    // Find all agents that have workflow data (nodes, edges)
    const agents = await prisma.agent.findMany({
      where: {
        nodes: { not: null },
        edges: { not: null }
      }
    });
    
    console.log(`Found ${agents.length} agents with workflow data to migrate`);

    // Process each agent to create corresponding workflows
    for (const agent of agents) {
      console.log(`Processing agent: ${agent.name} (${agent.id})`);
      
      try {
        // Determine workflow type based on old agent data
        const workflowType = agent['workflowType'] || WorkflowType.MASTER;
        
        // Create a workflow for this agent
        const workflow = await prisma.workflow.create({
          data: {
            name: agent.name,
            description: agent.description,
            nodes: agent.nodes || {},
            edges: agent.edges || {},
            startNodeId: agent.startNodeId,
            version: agent.version || 1,
            isPublished: agent.isPublished || false,
            publishedAt: agent.publishedAt,
            workflowType: workflowType as WorkflowType,
            agentId: agent.id,
            organizationId: agent.organizationId,
          }
        });

        console.log(`Created workflow ${workflow.id} for agent ${agent.id}`);
        
        // If this is a secondary workflow, find its master workflow by agent relationship
        if (workflowType === WorkflowType.SECONDARY && agent['masterAgentId']) {
          // Find the master agent's workflow
          const masterAgentWorkflow = await prisma.workflow.findFirst({
            where: {
              agentId: agent['masterAgentId']
            }
          });
          
          if (masterAgentWorkflow) {
            // Update this workflow to link to the master workflow
            await prisma.workflow.update({
              where: { id: workflow.id },
              data: {
                masterWorkflowId: masterAgentWorkflow.id
              }
            });
            
            console.log(`Linked secondary workflow ${workflow.id} to master workflow ${masterAgentWorkflow.id}`);
          } else {
            console.warn(`Could not find master workflow for agent ${agent['masterAgentId']}`);
          }
        }
        
      } catch (agentError) {
        console.error(`Error processing agent ${agent.id}:`, agentError);
      }
    }

    console.log('Workflow data migration completed successfully!');
    
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the migration
main()
  .then(() => {
    console.log('Migration script executed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
