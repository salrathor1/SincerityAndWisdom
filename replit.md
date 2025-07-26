# The Sunnah and Wisdom - Islamic Video Transcript Manager

## Overview

The Sunnah and Wisdom is a full-stack web application for managing Islamic educational video transcripts. It allows users to import YouTube videos, create and edit transcripts in multiple languages (Arabic and English), organize content into playlists, and manage their Islamic educational video collections with a modern, intuitive interface.

## Recent Changes

### January 26, 2025 - Created Arabic Transcripts Page with Draft System
- Created dedicated Arabic Transcripts page (/arabic-transcripts) for focused Arabic transcript editing
- Implemented video selection with thumbnail preview and duration display
- Added side-by-side layout: video player on left, transcript editor on right
- Integrated YouTube player with jump-to-time functionality for precise editing
- Dual view modes: "Segment View" (individual editing) and "SRT Format" (continuous text)
- Added segment management: add/delete segments with automatic time calculations
- Implemented Arabic text support with RTL direction and proper formatting
- Applied role-based access control (admin/editor can access, viewers see blank page)
- Added Arabic Transcripts menu item to sidebar navigation with BookOpen icon
- Enhanced time format consistency matching existing transcript editor
- **Added Draft System**: New draftContent database column for saving work-in-progress
- **Dual Button System**: "Save Draft" (outline) and "Publish" (primary) buttons
- **Draft Status Indicator**: Shows "Draft changes" badge when unsaved work exists
- **API Routes**: Added PUT /api/transcripts/:id/draft and POST /api/transcripts/:id/publish
- **Smart Loading**: Prioritizes draft content over published content when available

### January 25, 2025 - Added Video Sorting Functionality
- Added sort filters to videos page with "Oldest to Newest" and "Newest to Oldest" options
- Implemented sorting dropdown with ArrowUpDown icon in the header toolbar
- Videos now sort by creation date with oldest as default for chronological learning
- Added "Translations" button to each video card for direct navigation to translation page
- Enhanced user experience with intuitive sort controls and translation access alongside search functionality

### January 23, 2025 - Enhanced Translation Management System
- Created comprehensive Translations page (/translations) for comparing Arabic with other language translations
- Implemented professional side-by-side interface matching transcript editor design
- Added dual view modes: "Segment View" (individual editing) and "SRT View" (continuous text format)
- Enhanced timestamp editing with professional styling matching video transcript editor
- Implemented simple time format (0:00, 0:11, 0:30) with automatic SRT conversion for end times
- Added segment management: add/delete segments with proper timing calculations
- Integrated language selector supporting English, Urdu, French, Spanish, Turkish, and Malay
- Applied role-based access control (admin/editor can access, viewers see blank page)
- Added Translations menu item to sidebar navigation with Languages icon
- Supports independent translation segments not bound to Arabic timing structure

### January 23, 2025 - Fixed User Role Management
- Resolved role update functionality that was failing due to permission errors
- Updated both admin users (salrathor1@hotmail.com, abdulmunimparray@gmail.com) to admin role
- Fixed API call format in user management component to use correct parameters
- Added detailed error logging for better debugging of role-based access issues
- Role-based routing now properly blocks viewers from accessing admin features

### January 23, 2025 - Added Vocabulary Management System
- Added vocabulary field to videos database table for storing word definitions and notes
- Created tabbed interface in admin video editing modal with Transcript and Vocabulary tabs
- Implemented vocabulary save functionality with proper role-based permissions (admin/editor can edit)
- Added tabbed interface on landing page with Transcript and Vocabulary tabs
- Vocabulary content is displayed from database and shows appropriate empty states
- Applied consistent styling and modern tab design across both admin and public interfaces

### January 23, 2025 - Simplified Segment Sharing System
- Replaced complex multi-select system with intuitive from/to two-click selection
- Fixed end time calculation to include complete "to" segment duration
- Enhanced shared segment playbook with proper highlighting during video play
- Added toast notifications for successful link copying
- Improved visual feedback with color-coded segments (green=FROM, red=TO, blue=range, orange=shared)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a modern full-stack architecture with clear separation between client and server:

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Library**: Radix UI components with shadcn/ui styling system
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack React Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js server framework
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon serverless PostgreSQL
- **Authentication**: Replit Auth with OpenID Connect integration
- **Session Management**: PostgreSQL-backed session storage

## Key Components

### Authentication System
- Integrated Replit Auth using OpenID Connect protocol
- Session-based authentication with PostgreSQL session storage
- User profile management with automatic user creation/updates
- Protected routes with middleware-based authentication checks

### Database Schema
- **Users**: Profile information and authentication data
- **Videos**: YouTube video metadata (title, description, duration, thumbnails)
- **Playlists**: Video organization and categorization
- **Transcripts**: Multi-language transcript storage with timestamps
- **Sessions**: Secure session management for authentication

### API Architecture
- RESTful API design with Express.js
- Route organization in `/server/routes.ts`
- Centralized error handling and request logging
- YouTube API integration for video metadata fetching

### Frontend Components
- **Layout Components**: Sidebar navigation, responsive design
- **Modal System**: Add video modal, transcript editor with SRT import
- **Data Tables**: Videos, playlists, and transcripts listings
- **Form Components**: Video import, playlist creation, transcript editing, SRT file import

## Data Flow

1. **Authentication Flow**: Users authenticate via Replit Auth, sessions stored in PostgreSQL
2. **Video Import**: Users provide YouTube URL → API fetches metadata → Store in database
3. **Transcript Management**: Create/edit transcripts with real-time preview and timestamp support
4. **Playlist Organization**: Group videos into collections for better content management
5. **Dashboard Analytics**: Aggregate statistics and recent activity display

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL connection
- **drizzle-orm**: Type-safe ORM with PostgreSQL support
- **@tanstack/react-query**: Server state management
- **@radix-ui/react-***: Accessible UI component primitives
- **wouter**: Lightweight React router
- **zod**: Schema validation for forms and API

### Development Dependencies
- **Vite**: Build tool with React plugin
- **TypeScript**: Type safety and development experience
- **Tailwind CSS**: Utility-first styling
- **ESBuild**: Server-side bundling for production

### External APIs
- **YouTube Data API v3**: Video metadata and information retrieval
- **Replit Auth**: Authentication and user management service

## Deployment Strategy

### Development Environment
- Vite dev server for frontend with HMR support
- Express server with TypeScript compilation via TSX
- Database migrations handled by Drizzle Kit
- Replit-specific development tooling integration

### Production Build Process
1. Frontend build via Vite → static assets in `/dist/public`
2. Backend compilation via ESBuild → Node.js bundle in `/dist`
3. Database schema deployment via `drizzle-kit push`
4. Environment-specific configuration handling

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `YOUTUBE_API_KEY`: YouTube Data API access
- `SESSION_SECRET`: Session encryption key
- `REPLIT_DOMAINS`: Allowed authentication domains
- `ISSUER_URL`: OpenID Connect issuer endpoint

The application is designed for deployment on Replit with built-in database provisioning, authentication services, and development tooling integration.