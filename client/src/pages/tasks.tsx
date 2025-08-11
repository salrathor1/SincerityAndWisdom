import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Plus, ExternalLink, User, CheckCircle, Clock, Shield, BookOpen, Languages } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import type { Task, TaskWithUsers, User as UserType } from "@shared/schema";

export default function TasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "in-progress" | "complete">("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Fetch tasks based on user role
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/tasks", filter === "all" ? undefined : filter],
    enabled: !!user,
  });

  // Fetch all users for admin task assignment (only editors and admins)
  const { data: allUsers = [] } = useQuery({
    queryKey: ["/api/users"],
    enabled: user?.role === "admin",
  });

  // Filter users to only show admins and editors
  const assignableUsers = allUsers.filter((u: UserType) => 
    u.role === "admin" || 
    u.role === "arabic_transcripts_editor" || 
    u.role === "translations_editor"
  );

  // Debug log to see what users we have
  console.log("All users:", allUsers);
  console.log("Assignable users:", assignableUsers);

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: { description: string; assignedToUserId: string; taskLink?: string }) => {
      return await apiRequest("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setIsDialogOpen(false);
      toast({
        title: "Success",
        description: "Task created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create task",
        variant: "destructive",
      });
    },
  });

  // Update task status mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Success",
        description: "Task status updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update task",
        variant: "destructive",
      });
    },
  });

  const filteredTasks = tasks.filter((task: TaskWithUsers) => {
    if (filter === "all") return true;
    if (filter === "in-progress") return task.status === "In-Progress";
    if (filter === "complete") return task.status === "Complete";
    return true;
  });

  const handleCreateTask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    createTaskMutation.mutate({
      description: formData.get("description") as string,
      assignedToUserId: formData.get("assignedToUserId") as string,
      taskLink: formData.get("taskLink") as string || undefined,
    });
  };

  const handleStatusChange = (taskId: number, newStatus: string) => {
    updateTaskMutation.mutate({ id: taskId, status: newStatus });
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-gray-600">Please sign in to view tasks.</p>
        </div>
      </div>
    );
  }

  if (tasksLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ClipboardList className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-green-600" />
            Tasks Management
          </h1>
          <p className="text-gray-600 mt-2">
            {user.role === "admin" 
              ? "Assign and manage tasks for team members" 
              : "View and update your assigned tasks"}
          </p>
        </div>

        {user.role === "admin" && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>
                  Assign a task to a team member
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <Label htmlFor="description">Task Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Describe the task..."
                    required
                    className="min-h-20"
                  />
                </div>

                <div>
                  <Label htmlFor="assignedToUserId">Assign To</Label>
                  <Select name="assignedToUserId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableUsers.map((u: UserType) => (
                        <SelectItem key={u.id} value={u.id}>
                          <div className="flex items-center gap-2">
                            {u.role === "admin" && <Shield className="h-4 w-4 text-red-600" />}
                            {u.role === "arabic_transcripts_editor" && <BookOpen className="h-4 w-4 text-blue-600" />}
                            {u.role === "translations_editor" && <Languages className="h-4 w-4 text-green-600" />}
                            <span>
                              {u.firstName && u.lastName 
                                ? `${u.firstName} ${u.lastName}` 
                                : u.email}
                            </span>
                            <span className="text-xs text-gray-500 ml-auto">
                              {u.role === "admin" && "Admin"}
                              {u.role === "arabic_transcripts_editor" && "Arabic Editor"}
                              {u.role === "translations_editor" && "Translation Editor"}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="taskLink">Task Link (Optional)</Label>
                  <Input
                    id="taskLink"
                    name="taskLink"
                    type="url"
                    placeholder="https://..."
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createTaskMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={filter} onValueChange={(value: any) => setFilter(value)} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All Tasks</TabsTrigger>
          <TabsTrigger value="in-progress" className="text-orange-600">
            <Clock className="h-4 w-4 mr-2" />
            In Progress
          </TabsTrigger>
          <TabsTrigger value="complete" className="text-green-600">
            <CheckCircle className="h-4 w-4 mr-2" />
            Completed
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          {filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <ClipboardList className="h-16 w-16 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No {filter === "all" ? "" : filter} tasks found
                </h3>
                <p className="text-gray-500 text-center">
                  {user.role === "admin" 
                    ? "Create your first task to get started" 
                    : "No tasks have been assigned to you yet"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map((task: TaskWithUsers) => (
                <Card key={task.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">
                          {task.description}
                        </CardTitle>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            {task.assignedToUser?.role === "admin" && <Shield className="h-4 w-4 text-red-600" />}
                            {task.assignedToUser?.role === "arabic_transcripts_editor" && <BookOpen className="h-4 w-4 text-blue-600" />}
                            {task.assignedToUser?.role === "translations_editor" && <Languages className="h-4 w-4 text-green-600" />}
                            {!task.assignedToUser?.role && <User className="h-4 w-4" />}
                            <span>
                              {task.assignedToUser?.firstName && task.assignedToUser?.lastName
                                ? `${task.assignedToUser.firstName} ${task.assignedToUser.lastName}`
                                : task.assignedToUser?.email}
                            </span>
                            <span className="text-xs">
                              {task.assignedToUser?.role === "admin" && "(Admin)"}
                              {task.assignedToUser?.role === "arabic_transcripts_editor" && "(Arabic Editor)"}
                              {task.assignedToUser?.role === "translations_editor" && "(Translation Editor)"}
                            </span>
                          </div>
                          
                          <span>Created {format(new Date(task.createdAt), 'MMM d, yyyy')}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={task.status === "Complete" ? "default" : "secondary"}
                          className={task.status === "Complete" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}
                        >
                          {task.status}
                        </Badge>
                        
                        {task.taskLink && (
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                          >
                            <a href={task.taskLink} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-500">
                        {user.role === "admin" && task.createdByUser && (
                          <span>Created by {task.createdByUser.firstName && task.createdByUser.lastName
                            ? `${task.createdByUser.firstName} ${task.createdByUser.lastName}`
                            : task.createdByUser.email}
                          </span>
                        )}
                      </div>

                      {/* Status update controls */}
                      {(user.role === "admin" || task.assignedToUserId === user.id) && (
                        <div className="flex gap-2">
                          {task.status === "In-Progress" && (
                            <Button
                              size="sm"
                              onClick={() => handleStatusChange(task.id, "Complete")}
                              disabled={updateTaskMutation.isPending}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Mark Complete
                            </Button>
                          )}
                          
                          {task.status === "Complete" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(task.id, "In-Progress")}
                              disabled={updateTaskMutation.isPending}
                            >
                              <Clock className="h-4 w-4 mr-1" />
                              Reopen
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}