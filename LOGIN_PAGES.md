# Login Pages Documentation

This project includes two separate login pages for different user types:

## Member Login Page
- **URL**: `/login`
- **File**: `pages/login.tsx`
- **Purpose**: For regular members to join with invitation codes
- **Features**:
  - Invitation code input
  - Member login/signup options
  - Blue color scheme

## Instructor Login Page
- **URL**: `/InstructorLogin`
- **File**: `pages/InstructorLogin.tsx`
- **Purpose**: For instructors to access the instructor portal
- **Features**:
  - Instructor invitation code input
  - Instructor login/signup options
  - Red color scheme to differentiate from member login

## Styling
- **SCSS File**: `styles/login.scss`
- **Design**: Modern, glassmorphism-inspired design with blurred backgrounds
- **Responsive**: Mobile-friendly design
- **Animations**: Smooth transitions and hover effects

## Navigation
- **Component**: `components/Navigation.tsx`
- **Styles**: `styles/navigation.module.scss`
- **Features**: Fixed navigation bar with links to both login pages

## Main Page
- **File**: `pages/app/page.tsx`
- **Features**: Landing page with links to both login types
- **Design**: Gradient background with call-to-action buttons

## Usage
1. Start the development server: `npm run dev`
2. Navigate to `http://localhost:3000` for the main page
3. Use the navigation or buttons to access:
   - `http://localhost:3000/login` for member login
   - `http://localhost:3000/InstructorLogin` for instructor login

## Customization
- Colors can be modified in `styles/login.scss`
- Text content can be updated in the respective page components
- Styling follows the design shown in the provided image with Korean text
