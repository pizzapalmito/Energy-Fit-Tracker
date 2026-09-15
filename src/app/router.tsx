import { lazy } from 'react'
import { Navigate, createHashRouter } from 'react-router-dom'
import { AppShell } from './shell/AppShell'

const ExercisesPage = lazy(() => import('../features/exercises/ExercisesPage').then((module) => ({ default: module.ExercisesPage })))
const TodayPage = lazy(() => import('../features/today/TodayPage').then((module) => ({ default: module.TodayPage })))
const WorkoutPage = lazy(() => import('../features/workout/WorkoutPage').then((module) => ({ default: module.WorkoutPage })))
const WorkoutSummaryPage = lazy(() => import('../features/workout/WorkoutSummaryPage').then((module) => ({ default: module.WorkoutSummaryPage })))
const ProgressPage = lazy(() => import('../features/progress/ProgressPage').then((module) => ({ default: module.ProgressPage })))
const SettingsPage = lazy(() => import('../features/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })))

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      { path: 'today', element: <TodayPage /> },
      { path: 'workout', element: <WorkoutPage /> },
      { path: 'workout/summary/:workoutId', element: <WorkoutSummaryPage /> },
      { path: 'exercises', element: <ExercisesPage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: 'settings', element: <SettingsPage /> }
    ]
  }
])
