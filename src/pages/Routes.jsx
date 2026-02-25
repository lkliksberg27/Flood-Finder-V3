import React, { useState } from 'react';
import { entities } from '@/api/firestoreService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigation, Plus, Route } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import BottomNav from '@/components/ui/BottomNav';
import PageHeader from '@/components/ui/PageHeader';
import LoadingScreen from '@/components/ui/LoadingScreen';
import EmptyState from '@/components/ui/EmptyState';
import CourseCard from '@/components/routes/CourseCard';
import { checkRouteFlooding } from '@/components/routes/courseUtils';
import AddCourseForm from '@/components/routes/AddCourseForm';
import RoutesMap from '@/components/routes/RoutesMap';
import DrivingMode from '@/components/driving/DrivingMode';

export default function RoutesPage() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [drivingMode, setDrivingMode] = useState(false);

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => entities.Course.list('-created_date'),
  });

  const { data: sensors = [] } = useQuery({
    queryKey: ['sensors'],
    queryFn: () => entities.Sensor.list(),
    refetchInterval: 30000,
  });

  const { data: settingsList = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => entities.Settings.list(),
  });

  const locationEnabled = settingsList[0]?.locationEnabled ?? true;

  const createMutation = useMutation({
    mutationFn: (data) => entities.Course.create(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['courses'] });
      const prev = queryClient.getQueryData(['courses']);
      queryClient.setQueryData(['courses'], old => [{ ...data, id: '__optimistic__' }, ...(old || [])]);
      return { prev };
    },
    onError: (_, __, ctx) => queryClient.setQueryData(['courses'], ctx.prev),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['courses'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => entities.Course.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['courses'] });
      const prev = queryClient.getQueryData(['courses']);
      queryClient.setQueryData(['courses'], old => (old || []).map(c => c.id === id ? { ...c, ...data } : c));
      return { prev };
    },
    onError: (_, __, ctx) => queryClient.setQueryData(['courses'], ctx.prev),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['courses'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => entities.Course.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['courses'] });
      const prev = queryClient.getQueryData(['courses']);
      queryClient.setQueryData(['courses'], old => (old || []).filter(c => c.id !== id));
      return { prev };
    },
    onError: (_, __, ctx) => queryClient.setQueryData(['courses'], ctx.prev),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setExpandedCourse(null);
      setSelectedCourse(null);
      setSelectedRoute(null);
    },
  });

  const handleToggle = (courseId) => {
    if (expandedCourse === courseId) {
      setExpandedCourse(null);
      setSelectedRoute(null);
      setSelectedCourse(null);
    } else {
      setExpandedCourse(courseId);
      const course = courses.find(c => c.id === courseId);
      setSelectedCourse(course);
      setSelectedRoute(course?.routes?.find(r => r.direction === 'forward') || null);
    }
  };

  if (isLoading) return <LoadingScreen message="Loading your routes…" />;

  return (
    <>
      <AnimatePresence>
        {drivingMode && selectedRoute && (
          <DrivingMode
            route={selectedRoute}
            course={selectedCourse}
            sensors={sensors}
            locationEnabled={locationEnabled}
            onClose={() => setDrivingMode(false)}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-[#0c1021] pb-24 flex flex-col lg:flex-row">
        {/* Map */}
        <div className="h-[38vh] min-h-[200px] lg:h-screen lg:flex-1 lg:sticky lg:top-0">
          <RoutesMap
            selectedRoute={selectedRoute}
            sensors={sensors}
            course={selectedCourse}
            locationEnabled={locationEnabled}
          />
        </div>

        {/* Sidebar */}
        <div className="flex-1 lg:w-[400px] lg:max-w-[400px] lg:overflow-y-auto flex flex-col">
          <PageHeader
            title="Routes"
            subtitle={courses.length > 0 ? `${courses.length} saved location${courses.length > 1 ? 's' : ''}` : 'Save destinations for flood-aware routing'}
            action={
              <button
                onClick={() => setShowAddForm(v => !v)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  showAddForm ? 'bg-white/10 text-gray-300' : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            }
          />

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <AnimatePresence>
              {showAddForm && (
                <AddCourseForm
                  onClose={() => setShowAddForm(false)}
                  onSave={async (data) => {
                    await createMutation.mutateAsync(data);
                    setShowAddForm(false);
                  }}
                />
              )}
            </AnimatePresence>

            {courses.length === 0 && !showAddForm && (
              <EmptyState
                icon={Route}
                title="No routes yet"
                description="Add your work, home, or school to get flood-safe turn-by-turn directions."
                action={
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add First Location
                  </button>
                }
              />
            )}

            {courses.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                sensors={sensors}
                isExpanded={expandedCourse === course.id}
                onToggle={handleToggle}
                selectedRoute={selectedRoute}
                onSelectRoute={setSelectedRoute}
                onDrive={(route) => { setSelectedRoute(route); setDrivingMode(true); }}
                onUpdateCourse={(id, data) => updateMutation.mutate({ id, data })}
                onDeleteCourse={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        </div>

        <BottomNav />
      </div>
    </>
  );
}