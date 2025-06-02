---
trigger: manual
---

```
Workflows

Workflows are where you design the competencies or capabilities that you want your agent to have (outside answering basic questions with the knowledge base).

Each workflow starts with a set of triggers. These are the intents or phrases that will trigger the workflow to start. These are global — so the agent is always listening to them.

Imagine that you have an e-commerce agent. If a customer is speaking with your agent and then says 'can I join your rewards program?' it would just from wherever they are to the 'rewards program' trigger, and start the 'rewards' workflow.

Workflows are distinct from components, which are meant for reusability.

To learn more about organizing your agent as you scale up, see these building best practices.
Introduction to the Workflows CMS

Voiceflow’s Workflows CMS is the home for organizing and managing the conversation flows of your agent. This space serves as the command center for all your workflows, offering tools and features that support efficient project management and team collaboration.
Workflows Table Overview

The Workflows CMS table is organized to provide you with a comprehensive view of your agent details and their current statuses:

Name: The workflow's name, which should be specific and reflective of the workflow's function within the agent's conversational structure.
Description: AN explanation offering additional insight into the workflow's role and its overall contribution to the conversational experience.
Triggers: This column displays the intents or other actions that initiate the workflow, serving as a direct line to understanding user goals.
Status: Reveals the current progress state of the workflow, such as None, To Do, In Progress, or Done, allowing for efficient tracking of development stages.
Assignee: Shows which team member is currently responsible for the workflow.
Updated: Indicates the time of the last changes made to the workflow, helping maintain a record of updates.


Adding a New Workflow

To add a workflow, click on “New workflow” in the top right corner of the CMS.
In the prompted modal, provide the workflow's name and an optional Description.
Select “Create workflow” to move to the canvas and begin the build or modification process.

Editing an Existing Workflow

To begin editing, click on the desired workflow from the Workflows table.
The editor panel will appear, presenting options for customization.
Use the “Edit workflow” button in the editor to access the design canvas, where you can modify the workflow's configuration and logic.

Assigning a Workflow

To the left of the editor panel, click on the 'Assign to' icon, shown as the first letter of the assigned individual or "U" for unassigned.
You can assign the workflow to any team member who has either editor or viewer permissions in the agent.
Upon assignment, the designated team member will receive an email notification alerting them of the new task.
The selected assignee's name will be updated in the Assignee column of the Workflows table.

Updating a Workflow's Status

Click on the “Status” icon in the editor panel, shown as a colored status symbol representing is current status.
Choose the appropriate status for the workflow: None, To Do, In Progress, or Done.
Updating the status provides visibility for the team on the workflow’s progress and remaining action items.
The workflow's current status is reflected in the Status column and can be sorted in the Workflows Table for quick overview.

Deleting a Workflow

For individual workflow deletion, select the workflow, then use the ellipses (more options) icon in the editor to click “Delete”.
For bulk deletions, check the boxes beside multiple workflows, then use the 'Delete' option in the bulk action toolbar.
Confirm deletion prompts to complete the removal process.

Best Practices for Workflows:

Ensure workflow Names and Descriptions are clear and descriptive.
Regularly update the Status and Assignee information for accurate tracking.
Use folders to maintain an organized structure, particularly when working at scale.
Conduct periodic reviews of workflows to confirm their alignment with project objectives and overall agent functionality.

```