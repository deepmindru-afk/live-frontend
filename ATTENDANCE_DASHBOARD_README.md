# 🎨 Instructor Attendance Dashboard

## Overview
A modern, animated attendance dashboard for instructors to track and analyze their teaching sessions and participant engagement.

## ✨ Features

### 1. **Dashboard Summary Section**
- **Animated Statistics Cards** with smooth counting animations
- **Circular Progress Indicators** for visual data representation
- **Real-time Metrics**:
  - 🧾 Total Meetings Completed
  - 🕒 Total Teaching Time (HH:MM format)
  - 👥 Total Participants Across All Meetings
  - 📊 Average Attendance Rate (%)

### 2. **Meetings Table**
- **Modern Data Table** with hover effects and smooth transitions
- **Meeting Information**:
  - Meeting Title
  - Total Time
  - Begin/End Time (MM-DD HH:mm format)
  - Participant Count
  - Attendance Rate
  - Status (Completed/Live/Scheduled)
- **Action Buttons**: "📋 View Details" → navigates to detailed attendance page

### 3. **Meeting Detail Page** (`/instructor/attendance/[meetingId]`)
- **Circular Animated Counters**:
  - Total Meeting Time (in minutes)
  - Total Participants
  - Average Attendance Time (minutes)
- **Participant Data Table**:
  - Student Name with Avatar
  - Joined/Left Time
  - Total Duration
  - Attendance Rate (%)
  - Status Indicators
  - Hand Raise Status
- **Search & Filter** functionality
- **Export to Excel** capability

### 4. **Design & Aesthetics**
- **Tailwind CSS** + **shadcn/ui** components
- **Framer Motion** animations for smooth interactions
- **React CountUp** for animated number counting
- **Gradient Backgrounds** with light animated effects
- **Card Hover Animations** with scale-up effects
- **Responsive Design** - mobile-first approach
- **Clean Typography** with proper color hierarchy

## 🚀 Technology Stack

### Frontend
- **React 19** with TypeScript
- **Next.js 15** for routing and SSR
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **React CountUp** for number animations
- **Lucide React** for icons

### Backend Integration
- **GraphQL** queries for data fetching
- **Apollo Client** for state management
- **Mock GraphQL Service** for development

## 📁 File Structure

```
Live-frontend-/
├── pages/
│   ├── instructor/
│   │   ├── attendance.tsx              # Main dashboard
│   │   └── attendance/
│   │       └── [meetingId].tsx         # Meeting detail page
├── apollo/
│   └── meeting/
│       └── queries.ts                  # GraphQL queries
├── components/
│   └── InstructorNavigation.tsx        # Navigation component
└── ATTENDANCE_DASHBOARD_README.md      # This file
```

## 🔧 GraphQL Queries

### Available Queries
1. **GET_TUTOR_ATTENDANCE_SUMMARY** - Overall instructor statistics
2. **GET_MEETING_ATTENDANCE** - Detailed meeting attendance data
3. **GET_MEETING_BY_ID** - Individual meeting information
4. **GET_TUTOR_MEETINGS** - List of instructor's meetings

### Data Structure
```typescript
interface TutorAttendanceSummary {
  totalMeetings: number;
  totalTime: number; // in minutes
  totalParticipants: number;
  averageAttendance: number;
  meetings: Meeting[];
}

interface ParticipantAttendance {
  _id: string;
  displayName: string;
  email?: string;
  organization?: string;
  department?: string;
  role: string;
  joinedAt: string;
  leftAt?: string;
  totalTime: number;
  sessionCount: number;
  isCurrentlyOnline: boolean;
  status: string;
  micState: string;
  cameraState: string;
  hasHandRaised: boolean;
  sessions: Session[];
}
```

## 🎯 Key Features Implementation

### 1. **Animated Statistics**
- Uses `react-countup` for smooth number counting
- `framer-motion` for entrance animations
- Circular progress bars with SVG animations

### 2. **Responsive Design**
- Mobile-first approach with Tailwind CSS
- Grid layouts that adapt to screen size
- Touch-friendly interface elements

### 3. **Data Visualization**
- Progress bars for attendance rates
- Color-coded status indicators
- Interactive hover effects

### 4. **Export Functionality**
- CSV export with Korean headers
- Includes all participant data
- Formatted for Excel compatibility

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- React 19
- Next.js 15

### Installation
```bash
# Install dependencies
npm install framer-motion react-countup recharts @radix-ui/react-progress @radix-ui/react-dialog @radix-ui/react-icons lucide-react

# Start development server
npm run dev
```

### Usage
1. Navigate to `/instructor/attendance` for the main dashboard
2. Click "상세보기" on any meeting to view detailed attendance
3. Use search functionality to filter participants
4. Export data using the "Excel 다운로드" button

## 🎨 Design Principles

### Color Scheme
- **Primary**: Blue (#3B82F6) to Purple (#8B5CF6) gradient
- **Success**: Green (#10B981)
- **Warning**: Yellow (#F59E0B)
- **Error**: Red (#EF4444)
- **Neutral**: Gray scale for text and backgrounds

### Typography
- **Headings**: Font-bold, text-gray-800
- **Body**: Font-medium, text-gray-700
- **Captions**: Text-gray-500
- **Accent**: text-blue-600

### Animations
- **Entrance**: Fade-in with slight upward movement
- **Hover**: Scale-up (1.05) with shadow increase
- **Loading**: Spinning indicators
- **Transitions**: 200-300ms duration for smooth feel

## 🔮 Future Enhancements

1. **Real-time Updates** - WebSocket integration for live data
2. **Advanced Analytics** - Charts and graphs for trend analysis
3. **Bulk Actions** - Select multiple participants for actions
4. **Notification System** - Alerts for attendance issues
5. **Mobile App** - React Native version for mobile access
6. **AI Insights** - Machine learning for attendance predictions

## 📝 Notes

- Currently uses mock data for demonstration
- GraphQL queries are defined but may need backend implementation
- All animations are optimized for performance
- Responsive design tested on mobile, tablet, and desktop
- Accessibility features included (ARIA labels, keyboard navigation)

## 🤝 Contributing

1. Follow the existing code style and patterns
2. Add proper TypeScript types
3. Include animations for new interactive elements
4. Test on multiple screen sizes
5. Update this README for new features
