# Workflow Canvas User Journey

## User Persona: Sarah, Conversational AI Designer

**Background**: Sarah is a 32-year-old conversational designer at a mid-sized company. She has experience designing chatbots but is not a developer. She needs to create complex conversation flows for customer support without writing code.

**Goals**:
- Design intuitive conversation flows
- Test flows before deploying to production
- Reuse common conversation patterns
- Collaborate with team members

## User Journey

### 1. Accessing the Workflow Canvas

**Scenario**: Sarah logs into the Jibu Console to create a new customer support workflow.

**Actions**:
- Sarah navigates to the Workflows section from the main dashboard
- She clicks "Create Workflow" and enters a name and description
- The system creates a new workflow and opens the canvas editor

**Experience**:
> "I like how the canvas opens with a clean interface. The Start node is already placed for me, which makes it easy to begin designing. The infinite canvas gives me plenty of space to work with complex flows."

### 2. Adding and Configuring Nodes

**Scenario**: Sarah wants to build a flow that greets users, offers help options, and handles different user responses.

**Actions**:
- She opens the node palette and browses through the available node categories
- From the "Talk" category, she drags a Message node onto the canvas
- She connects the Start node to the Message node
- She clicks on the Message node to open the inspector panel
- In the inspector, she enters the greeting text: "Hello! Welcome to customer support. How can I help you today?"
- She adds a Listen node to capture user input

**Experience**:
> "The node categories are well organized, making it easy to find what I need. I appreciate that when I click on a node, the inspector panel shows me all the properties I can configure. The real-time preview of how my message will look is very helpful."

### 3. Creating Branching Paths

**Scenario**: Sarah wants to create different paths based on user responses.

**Actions**:
- She adds a Choice node after the Listen node
- In the inspector, she defines three options: "Account Issues", "Billing Questions", and "Technical Support"
- She creates three separate branches from the Choice node
- For each branch, she adds relevant Message nodes with appropriate responses
- She customizes the path connections, making them curved and color-coding them by topic

**Experience**:
> "I love how I can create multiple paths visually. The ability to customize the paths with colors helps me keep track of different conversation flows. The automatic layout feature saves me time when organizing complex branches."

### 4. Using Components for Reusability

**Scenario**: Sarah needs to include a standard "collect user information" sequence in multiple places.

**Actions**:
- She selects several nodes that make up the user information collection process
- She right-clicks and selects "Create Component"
- She names the component "Collect User Info" and adds a description
- The system converts the selected nodes into a single component node
- She can now drag this component from her library to reuse it elsewhere

**Experience**:
> "The component system is a game-changer for me. I no longer need to rebuild common sequences. I can create a component once and reuse it throughout my workflows. When I need to update how we collect user information, I only need to edit the component once, and it updates everywhere."

### 5. Testing the Workflow

**Scenario**: Sarah wants to test her workflow before publishing it.

**Actions**:
- She clicks the "Test" button in the toolbar
- A test panel opens alongside the canvas
- She can interact with the workflow as an end user would
- She sees the conversation progressing through the nodes on the canvas in real-time
- When she encounters an issue, she can pause the execution and inspect variables

**Experience**:
> "The testing feature is intuitive and powerful. I can see exactly how my workflow behaves and which paths are being taken. The ability to pause and inspect variables helps me debug issues quickly. The visual indication of the active node during testing makes it easy to follow the conversation flow."

### 6. Collaborating with Team Members

**Scenario**: Sarah needs feedback from her colleague Alex before publishing.

**Actions**:
- She saves her workflow
- She assigns the workflow to Alex for review
- Alex receives a notification and opens the workflow
- Alex adds comments directly on specific nodes
- Alex suggests changes using the commenting feature
- Sarah reviews the comments and makes necessary adjustments

**Experience**:
> "The collaboration features make the review process smooth. I can assign workflows to specific team members, and they can leave contextual comments right on the nodes that need attention. The version history lets me see what changes were made and revert if needed."

### 7. Publishing and Monitoring

**Scenario**: Sarah is ready to publish her workflow and monitor its performance.

**Actions**:
- She clicks the "Publish" button after finalizing the workflow
- She selects which assistant(s) should use this workflow
- The system deploys the workflow and makes it available to end users
- She can monitor metrics such as completion rate, average conversation length, and common exit points

**Experience**:
> "The publishing process is straightforward, and I appreciate being able to choose which assistants should use this workflow. The analytics dashboard gives me valuable insights into how users are interacting with my workflow, helping me identify areas for improvement."

## Key Takeaways from User Journey

1. **Visual Design is Intuitive**: The canvas interface makes it easy to design complex flows without coding knowledge.

2. **Node Configuration is Contextual**: The inspector panel provides relevant options based on the selected node type.

3. **Components Save Time**: The ability to create reusable components significantly speeds up the design process.

4. **Real-time Testing is Crucial**: Integrated testing tools help identify and fix issues before deployment.

5. **Collaboration Features Enhance Teamwork**: Assignment, commenting, and version history facilitate team collaboration.

6. **Analytics Drive Improvement**: Performance metrics help designers continuously improve their workflows.

## Feature Priorities Based on User Needs

1. **Must-Have Features**:
   - Intuitive drag-and-drop canvas
   - Basic node types (Start, Message, Listen, Choice)
   - Visual path connections
   - Node configuration panel
   - Basic testing capabilities

2. **High-Value Features**:
   - Component creation and reuse
   - Conditional logic nodes
   - Variable management
   - Path customization (colors, styles)
   - Version history

3. **Enhancement Features**:
   - Collaboration tools (comments, assignments)
   - Advanced testing with variable inspection
   - Analytics and performance metrics
   - Template library
   - Keyboard shortcuts and productivity tools
