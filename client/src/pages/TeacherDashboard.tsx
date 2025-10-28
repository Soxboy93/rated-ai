import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Users, BookOpen, TrendingUp, Award } from "lucide-react";
import { useLocation } from "wouter";

export default function TeacherDashboard() {
  const [, setLocation] = useLocation();
  const [classroomName, setClassroomName] = useState("");

  const { data: classrooms } = trpc.teacher.getClassrooms.useQuery();
  const createClassroom = trpc.teacher.createClassroom.useMutation({
    onSuccess: () => {
      setClassroomName("");
      window.location.reload();
    },
  });

  const handleCreateClassroom = async () => {
    if (classroomName) {
      await createClassroom.mutateAsync({ name: classroomName });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Teacher Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-600" />
            <span className="text-sm text-gray-600">
              {classrooms?.length || 0} Classrooms
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Create Classroom Card */}
        <Card className="p-6 mb-8 bg-gradient-to-r from-blue-500 to-purple-500 text-white">
          <h2 className="text-xl font-bold mb-4">Create New Classroom</h2>
          <div className="flex gap-3">
            <Input
              placeholder="e.g., Grade 5 Math - Room 101"
              value={classroomName}
              onChange={(e) => setClassroomName(e.target.value)}
              className="bg-white text-gray-900"
            />
            <Button
              onClick={handleCreateClassroom}
              disabled={createClassroom.isPending}
              className="bg-white text-blue-600 hover:bg-gray-100"
            >
              {createClassroom.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </Card>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">0</div>
                <div className="text-sm text-gray-600">Total Students</div>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-8 h-8 text-green-600" />
              <div>
                <div className="text-2xl font-bold">0</div>
                <div className="text-sm text-gray-600">Active Lessons</div>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-8 h-8 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">0%</div>
                <div className="text-sm text-gray-600">Avg Progress</div>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Award className="w-8 h-8 text-yellow-600" />
              <div>
                <div className="text-2xl font-bold">0</div>
                <div className="text-sm text-gray-600">Achievements</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Classrooms List */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-4">My Classrooms</h2>
          
          {classrooms && classrooms.length > 0 ? (
            classrooms.map((classroom) => (
              <Card key={classroom.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-2">{classroom.name}</h3>
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span>👥 {classroom.studentCount || 0} students</span>
                      {classroom.gradeLevel && <span>📚 {classroom.gradeLevel}</span>}
                      {classroom.subject && <span>📖 {classroom.subject}</span>}
                    </div>
                  </div>
                  <Button>View Details</Button>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-12 text-center">
              <div className="text-6xl mb-4">👩‍🏫</div>
              <h3 className="text-xl font-bold mb-2">No Classrooms Yet</h3>
              <p className="text-gray-600 mb-4">
                Create your first classroom to start monitoring student progress!
              </p>
            </Card>
          )}
        </div>

        {/* Features Info */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-bold mb-2">Real-Time Analytics</h3>
            <p className="text-sm text-gray-600">
              Monitor student progress, engagement, and learning patterns in real-time.
            </p>
          </Card>
          <Card className="p-6">
            <div className="text-3xl mb-3">📚</div>
            <h3 className="font-bold mb-2">Curriculum Aligned</h3>
            <p className="text-sm text-gray-600">
              Every AI interaction is tagged with Common Core standards for easy tracking.
            </p>
          </Card>
          <Card className="p-6">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="font-bold mb-2">Assign & Track</h3>
            <p className="text-sm text-gray-600">
              Assign AI tutoring sessions and track completion across your entire class.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

