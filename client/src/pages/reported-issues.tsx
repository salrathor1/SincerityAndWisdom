import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ReportedIssueWithRelations } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, CheckCircle, Clock, User, Video, List, FileText } from "lucide-react";

export default function ReportedIssues() {
  const [selectedIssue, setSelectedIssue] = useState<ReportedIssueWithRelations | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [newStatus, setNewStatus] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: issues = [], isLoading } = useQuery<ReportedIssueWithRelations[]>({
    queryKey: ["/api/reported-issues"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; status?: string; adminNote?: string }) => {
      await apiRequest("PUT", `/api/reported-issues/${data.id}`, {
        status: data.status,
        adminNote: data.adminNote,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Issue updated successfully.",
      });
      setSelectedIssue(null);
      setAdminNote("");
      setNewStatus("");
      queryClient.invalidateQueries({ queryKey: ["/api/reported-issues"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update issue.",
        variant: "destructive",
      });
    },
  });

  const handleUpdateIssue = () => {
    if (!selectedIssue) return;
    
    const statusToUpdate = newStatus || selectedIssue.status;
    
    updateMutation.mutate({
      id: selectedIssue.id,
      status: statusToUpdate,
      adminNote: adminNote || selectedIssue.adminNote || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return <Badge variant="destructive" className="gap-1"><Clock className="w-3 h-3" />Pending</Badge>;
      case "Complete":
        return <Badge variant="default" className="gap-1"><CheckCircle className="w-3 h-3" />Complete</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-muted-foreground">Loading reported issues...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-6 h-6 text-red-500" />
        <div>
          <h1 className="text-3xl font-bold">Reported Issues</h1>
          <p className="text-muted-foreground">Review and manage user-reported problems</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Issues List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">All Issues ({issues.length})</h2>
            <div className="flex gap-2">
              {getStatusBadge("Pending")} {issues.filter(i => i.status === "Pending").length}
              {getStatusBadge("Complete")} {issues.filter(i => i.status === "Complete").length}
            </div>
          </div>
          
          {issues.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
                <h3 className="text-lg font-medium mb-2">No Issues Reported</h3>
                <p className="text-muted-foreground text-center">
                  All clear! No problems have been reported by users.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {issues.map((issue) => (
                <Card 
                  key={issue.id} 
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedIssue?.id === issue.id ? "border-primary" : ""
                  }`}
                  onClick={() => setSelectedIssue(issue)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(issue.status)}
                          <span className="text-sm text-muted-foreground">
                            #{issue.id}
                          </span>
                        </div>
                        
                        <p className="text-sm font-medium line-clamp-2">
                          {issue.description}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {issue.reportedByUser && (
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {issue.reportedByUser.email}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {issue.createdAt && formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Issue Details */}
        <div className="space-y-4">
          {selectedIssue ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    Issue #{selectedIssue.id}
                    {getStatusBadge(selectedIssue.status)}
                  </CardTitle>
                </div>
                <CardDescription>
                  Reported {selectedIssue.createdAt && formatDistanceToNow(new Date(selectedIssue.createdAt), { addSuffix: true })}
                  {selectedIssue.reportedByUser && ` by ${selectedIssue.reportedByUser.email}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Context Information */}
                <div className="space-y-4">
                  <h4 className="font-medium">Context</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <List className="w-4 h-4 text-muted-foreground" />
                      <span>Playlist:</span>
                      <span className="font-medium">
                        {selectedIssue.playlist?.name || "None specified"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-muted-foreground" />
                      <span>Video:</span>
                      <span className="font-medium">
                        {selectedIssue.video?.title || "None specified"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span>Segment:</span>
                      <span className="font-medium">
                        {selectedIssue.segmentIndex !== null ? `#${selectedIssue.segmentIndex}` : "None specified"}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Problem Description */}
                <div className="space-y-2">
                  <h4 className="font-medium">Problem Description</h4>
                  <div className="bg-muted p-3 rounded text-sm">
                    {selectedIssue.description}
                  </div>
                </div>

                {/* Contact Information */}
                {(selectedIssue.contactName || selectedIssue.contactEmail || selectedIssue.contactMobile) && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="font-medium">Contact Information</h4>
                      <div className="bg-muted p-3 rounded text-sm space-y-1">
                        {selectedIssue.contactName && (
                          <div>
                            <span className="font-medium">Name:</span> {selectedIssue.contactName}
                          </div>
                        )}
                        {selectedIssue.contactEmail && (
                          <div>
                            <span className="font-medium">Email:</span> {selectedIssue.contactEmail}
                          </div>
                        )}
                        {selectedIssue.contactMobile && (
                          <div>
                            <span className="font-medium">Mobile:</span> {selectedIssue.contactMobile}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Admin Actions */}
                <div className="space-y-4">
                  <h4 className="font-medium">Admin Actions</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select 
                      value={newStatus || selectedIssue.status} 
                      onValueChange={setNewStatus}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Complete">Complete</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-note">Admin Notes</Label>
                    <Textarea
                      id="admin-note"
                      placeholder="Add notes about resolution or next steps..."
                      value={adminNote || selectedIssue.adminNote || ""}
                      onChange={(e) => setAdminNote(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <Button 
                    onClick={handleUpdateIssue}
                    disabled={updateMutation.isPending}
                    className="w-full"
                  >
                    {updateMutation.isPending ? "Updating..." : "Update Issue"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Select an Issue</h3>
                <p className="text-muted-foreground text-center">
                  Choose an issue from the list to view details and manage it.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}