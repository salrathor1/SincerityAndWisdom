# Sincerity and Wisdom - Islamic Video Transcript Manager

## Overview

Sincerity and Wisdom is a full-stack web application designed for comprehensive management of Islamic educational video transcripts. Its core purpose is to enable users to import YouTube videos, create and edit transcripts in multiple languages (Arabic and English), organize content into playlists, and efficiently manage their Islamic educational video collections through a modern and intuitive interface. The project aims to streamline the process of producing and organizing high-quality Islamic educational content, enhancing accessibility and dissemination.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application adopts a modern full-stack architecture, ensuring clear separation between client and server responsibilities.

### Frontend Architecture
- **Framework**: React 18 with TypeScript for robust and type-safe development.
- **UI/UX**: Utilizes Radix UI components for accessibility and a foundational styling system provided by shadcn/ui.
- **Styling**: Tailwind CSS is used for utility-first styling, complemented by CSS variables for flexible theming.
- **State Management**: TanStack React Query handles server state management efficiently.
- **Routing**: Wouter provides lightweight client-side routing.
- **Form Handling**: React Hook Form is used for form management, integrated with Zod for validation.
- **Core UI/UX Decisions**: The application features a streamlined interface with a focus on task management for admins and editors, role-based landing pages, and intuitive navigation. Specific design elements include collapsible sidebars, professional tabbed interfaces with status badges, and color-coded visual distinctions for content states (e.g., draft vs. published).

### Backend Architecture
- **Runtime**: Node.js with Express.js serving as the web application framework.
- **Database**: PostgreSQL is the chosen relational database, managed through Drizzle ORM for type-safe database interactions.
- **Database Provider**: Neon serverless PostgreSQL provides the database infrastructure.
- **Authentication**: Replit Auth, leveraging OpenID Connect, handles user authentication.
- **Session Management**: Sessions are persistently stored in PostgreSQL.
- **API Architecture**: Adheres to a RESTful design, organized in `/server/routes.ts`, with centralized error handling.

### Key Features and Technical Implementations
- **Mobile Optimization**: Responsive design with hidden login button and playlist video count on mobile devices for cleaner interface.
- **Authentication System**: Integrates Replit Auth for secure, session-based authentication, supporting user profile management and role-based access control (e.g., admin, Arabic transcript editor, translation editor).
- **Video Management**: Supports importing YouTube videos with metadata fetching via YouTube Data API v3. New videos are automatically appended to playlists with intelligent `playlistOrder` assignment.
- **Transcript Management**:
    - **Arabic Transcripts Page**: Dedicated interface for Arabic transcript editing with side-by-side video player, jump-to-time functionality, and dual view modes (Segment View, SRT Format).
    - **Draft System**: Implements a robust draft system for Arabic transcripts, allowing saving work-in-progress to a `draftContent` column, with auto-save functionality, status indicators, and separate views for draft and published content.
    - **Translation Management System**: Comprehensive page for comparing Arabic transcripts with multiple language translations (English, Urdu, French, Spanish, Turkish, Malay) in a side-by-side interface, supporting independent translation segments.
    - **SRT Support**: Enhanced support for various SRT timestamp formats.
- **Content Organization**: Videos can be grouped into playlists.
- **Task Management System**: Features a `tasks` database table, allowing admins to create and manage tasks with role-based access, status filtering, and assignment capabilities.
- **Vocabulary Management**: Integrated vocabulary field for videos, with a tabbed interface for editing and displaying definitions alongside transcripts.
- **Segment Sharing**: Simplified two-click segment selection for sharing video portions with highlighting and toast notifications.
- **Support Us Ribbon**: Persistent ribbon component that appears on every page load to encourage community support and contributions, with modal containing contact information and donation links.

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: For connecting to serverless PostgreSQL.
- **drizzle-orm**: ORM for PostgreSQL database interactions.
- **@tanstack/react-query**: For server state management in the frontend.
- **@radix-ui/react-***: Provides accessible UI component primitives.
- **wouter**: Lightweight React router.
- **zod**: Used for schema validation.

### External APIs
- **YouTube Data API v3**: Utilized for fetching video metadata.
- **Replit Auth**: Provides authentication and user management services.