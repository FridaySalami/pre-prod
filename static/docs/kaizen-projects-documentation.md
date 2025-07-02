# Kaizen Projects Documentation

## Overview

The Kaizen Projects page is a dynamic and interactive tool designed to manage continuous improvement ideas from submission to completion. It utilizes a Kanban-style board, providing a clear visual workflow for tracking the status of each project. This system fosters collaboration, transparency, and engagement in the company's improvement initiatives.

## Key Features

-   **Kanban Board Interface**: Projects are organized into four status columns: "New Submissions," "Under Review," "In Progress," and "Completed."
-   **Drag-and-Drop Functionality**: Easily update a project's status by dragging its card from one column to another.
-   **Project Submission**: A simple form allows any user to submit a new improvement idea by providing a title, category, and brief description.
-   **Project Detail View**: Click on any project card to open a detailed panel with more information, including a detailed description, owner, and deadline.
-   **Commenting System**: Collaborate and discuss projects by adding comments in the detail panel.
-   **Voting/Liking System**: Show support for a project by giving it a "thumbs up." The number of likes helps gauge project popularity and priority.
-   **Real-time Updates**: The board and project details are updated in real-time as changes are made.

## How to Use the Kaizen Projects Page

### Submitting a New Project

1.  Click the **"Submit New"** button at the top of the board.
2.  A panel will appear with a form.
3.  Fill in the required fields:
    *   **Title**: A concise and descriptive title for the project.
    *   **Category**: Select the most relevant business area (e.g., "Operations," "Sales," "Warehouse").
    *   **Brief Description**: A short summary of the idea.
4.  Click **"Submit Project"**. Your new project will appear in the "New Submissions" column.

### Managing Projects on the Board

-   **Viewing Details**: Click on any project card to open the detail panel.
-   **Changing Status**: To move a project to the next stage (e.g., from "New Submissions" to "Under Review"), simply click and hold the project card, drag it to the desired column, and release.

### Interacting with a Project

Inside the **Project Detail Panel**:

-   **Read Descriptions**: Understand the project's purpose from the brief and detailed descriptions.
-   **Add Comments**: Use the comment box to ask questions, provide feedback, or offer suggestions.
-   **Like a Project**: Click the "thumbs up" icon to show your support. You can also remove your like by clicking it again.
-   **Update Details**: If you are the project owner or an admin, you can edit the project's details, assign an owner, or set a deadline.
-   **Delete a Project**: If you have the necessary permissions, you can delete a project.

## Project Statuses Explained

-   **New Submissions**: All new ideas start here. They are waiting to be evaluated.
-   **Under Review**: The project is being assessed for feasibility, impact, and resource requirements.
-   **In Progress**: The project has been approved and is actively being worked on.
-   **Completed**: The project has been successfully implemented.

## Data Source

The Kaizen Projects board is powered by several tables in the Supabase database, including `kaizen_projects`, `comments`, and `project_likes`. All interactions are saved and reflected in real-time.
