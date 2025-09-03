import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Bot, User, Send, Plus, Trash2, MessageSquare, Settings, Sparkles, Info, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface GeminiConversation {
  id: number;
  title: string;
  model: string;
  systemPrompt: string | null;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

const availableModels = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommended)' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-2.0-flash-preview', label: 'Gemini 2.0 Flash Preview' },
];

export default function GeminiChatPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [systemPrompt, setSystemPrompt] = useState('- You are a world famous Arabic grammarian with a PhD from the Islamic University of Madinah that never misses anything. Please add harakaat to this file and keep its original formatting. Do not add any additional words or references.\n\n- Please decide where the sentences should be, keep the same structure but remove the timestamps that are in the middle only keeping the timestamp at the end of the sentence.\n\n- If a sentence is less than 5 words you can add it to the next sentence but only if the whole sentence will be lesson than 20 words!');
  const [conversationTitle, setConversationTitle] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [showApiDetails, setShowApiDetails] = useState(false);
  const [lastApiRequest, setLastApiRequest] = useState<any>(null);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch conversations
  const { data: conversations = [], isLoading: loadingConversations } = useQuery<GeminiConversation[]>({
    queryKey: ['/api/gemini/conversations'],
  });

  // Debug logging
  useEffect(() => {
    console.log('Conversations data updated:', conversations);
    console.log('Selected conversation ID:', selectedConversationId);
    console.log('Active tab:', activeTab);
  }, [conversations, selectedConversationId, activeTab]);

  // Fetch selected conversation details
  const { data: selectedConversation, refetch: refetchConversation } = useQuery<GeminiConversation>({
    queryKey: ['/api/gemini/conversations', selectedConversationId],
    enabled: !!selectedConversationId,
  });

  // Create new conversation mutation
  const createConversation = useMutation<GeminiConversation, Error, { title: string; model: string; systemPrompt?: string }>({
    mutationFn: async (data: { title: string; model: string; systemPrompt?: string }) => {
      // Capture API request details
      const requestDetails = {
        method: 'POST',
        url: '/api/gemini/conversations',
        body: data,
        timestamp: new Date().toISOString(),
      };
      setLastApiRequest(requestDetails);
      
      const response = await apiRequest('POST', '/api/gemini/conversations', data);
      return await response.json();
    },
    onSuccess: async (newConversation) => {
      console.log('New conversation created:', newConversation);
      
      // Update conversations list in cache immediately
      const existingConversations = queryClient.getQueryData<GeminiConversation[]>(['/api/gemini/conversations']) || [];
      const updatedConversations = [newConversation, ...existingConversations];
      queryClient.setQueryData(['/api/gemini/conversations'], updatedConversations);
      
      // Set conversation data in cache
      queryClient.setQueryData(['/api/gemini/conversations', newConversation.id], newConversation);
      
      // Set the selected conversation ID
      setSelectedConversationId(newConversation.id);
      setIsCreatingNew(false);
      setConversationTitle('');
      
      // Update form state with new conversation data
      setSelectedModel(newConversation.model);
      setSystemPrompt(newConversation.systemPrompt || '');
      
      console.log('Updated conversations list:', updatedConversations);
      console.log('Selected conversation ID set to:', newConversation.id);
      
      toast({
        title: "Success",
        description: "New conversation created and ready for setup!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create conversation",
        variant: "destructive",
      });
    },
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (data: { conversationId: number; message: string; model: string; systemPrompt?: string }) => {
      // Capture API request details
      const requestBody = {
        message: data.message,
        model: data.model,
        systemPrompt: data.systemPrompt
      };
      
      const requestDetails = {
        method: 'POST',
        url: `/api/gemini/conversations/${data.conversationId}/message`,
        body: requestBody,
        timestamp: new Date().toISOString(),
        conversationId: data.conversationId
      };
      setLastApiRequest(requestDetails);
      
      const response = await apiRequest('POST', `/api/gemini/conversations/${data.conversationId}/message`, requestBody);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gemini/conversations', selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ['/api/gemini/conversations'] });
      setCurrentMessage('');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  // Delete conversation mutation
  const deleteConversation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/gemini/conversations/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gemini/conversations'] });
      const conversationsList = Array.isArray(conversations) ? conversations : [];
      if (selectedConversationId === conversationsList[0]?.id) {
        setSelectedConversationId(null);
      }
      toast({
        title: "Success",
        description: "Conversation deleted successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive",
      });
    },
  });

  // Update conversation settings mutation
  const updateConversation = useMutation({
    mutationFn: async (data: { id: number; model?: string; systemPrompt?: string }) => {
      const response = await apiRequest('PUT', `/api/gemini/conversations/${data.id}`, {
        model: data.model,
        systemPrompt: data.systemPrompt,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gemini/conversations', selectedConversationId] });
      toast({
        title: "Success",
        description: "Conversation settings updated!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update conversation",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversation?.messages]);

  // Update model and system prompt when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      console.log('Selected conversation updated:', selectedConversation);
      setSelectedModel(selectedConversation.model);
      setSystemPrompt(selectedConversation.systemPrompt || '');
    }
  }, [selectedConversation]);

  const generateConversationTitle = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit' 
    });
    return `Chat ${dateStr}`;
  };

  const handleCreateConversation = () => {
    const title = conversationTitle.trim() || generateConversationTitle();
    
    createConversation.mutate({
      title,
      model: selectedModel,
      systemPrompt: systemPrompt || undefined,
    });
  };

  const handleQuickCreateConversation = () => {
    createConversation.mutate({
      title: generateConversationTitle(),
      model: selectedModel,
      systemPrompt: systemPrompt || undefined,
    });
  };

  const handleSendMessage = () => {
    if (!currentMessage.trim() || !selectedConversationId) return;

    sendMessage.mutate({
      conversationId: selectedConversationId,
      message: currentMessage,
      model: selectedModel,
      systemPrompt: systemPrompt || undefined,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleUpdateSettings = () => {
    if (!selectedConversationId) return;

    updateConversation.mutate({
      id: selectedConversationId,
      model: selectedModel,
      systemPrompt: systemPrompt,
    });
  };

  const handleCopyMessage = async (content: string, messageIndex: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(messageIndex);
      toast({
        title: "Copied!",
        description: "Message copied to clipboard",
      });
      // Reset the copied state after 2 seconds
      setTimeout(() => setCopiedMessageIndex(null), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy message",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="h-6 w-6 text-purple-600" />
        <h1 className="text-3xl font-bold">Gemini AI Chat</h1>
        <Badge variant="secondary">Admin Only</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
        {/* Sidebar - Conversations List */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6 h-[calc(100vh-120px)]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Conversations</CardTitle>
                <Button
                  size="sm"
                  onClick={handleQuickCreateConversation}
                  disabled={createConversation.isPending}
                  data-testid="button-new-conversation"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 h-[calc(100vh-220px)] overflow-y-auto">
              {isCreatingNew && (
                <Card className="p-3 border-dashed">
                  <div className="space-y-2">
                    <Input
                      placeholder="Conversation title"
                      value={conversationTitle}
                      onChange={(e) => setConversationTitle(e.target.value)}
                      data-testid="input-conversation-title"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleCreateConversation}
                        disabled={createConversation.isPending}
                        data-testid="button-create-conversation"
                      >
                        Create
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIsCreatingNew(false);
                          setConversationTitle('');
                        }}
                        data-testid="button-cancel-create"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {loadingConversations ? (
                <div className="text-center text-gray-500 py-4">Loading conversations...</div>
              ) : !Array.isArray(conversations) || conversations.length === 0 ? (
                <div className="text-center text-gray-500 py-4">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No conversations yet</p>
                </div>
              ) : (
                conversations.map((conversation: GeminiConversation) => {
                  console.log('Rendering conversation:', conversation.id, conversation.title);
                  return (
                    <Card
                    key={conversation.id}
                    className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedConversationId === conversation.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => {
                    console.log('Selecting conversation:', conversation.id);
                    setSelectedConversationId(conversation.id);
                  }}
                    data-testid={`conversation-${conversation.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{conversation.title}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(new Date(conversation.updatedAt), 'MMM dd, HH:mm')}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">{conversation.model}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation.mutate(conversation.id);
                        }}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        data-testid={`button-delete-${conversation.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    </Card>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Chat Area */}
        <div className="lg:col-span-3">
          {selectedConversationId ? (
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <CardTitle className="text-lg">
                      {selectedConversation?.title || 'Loading...'}
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      Messages: {selectedConversation?.messages?.length || 0}
                    </p>
                  </div>
                </div>

                {/* Model and System Prompt Controls */}
                <div className="space-y-4 border-t pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        AI Model
                      </label>
                      <Select
                        value={selectedModel}
                        onValueChange={setSelectedModel}
                      >
                        <SelectTrigger data-testid="select-model">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableModels.map((model: any) => (
                            <SelectItem key={model.value} value={model.value}>
                              {model.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        System Prompt
                      </label>
                      <Textarea
                        placeholder="Enter system instructions for the AI (optional)"
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        className="min-h-[40px] max-h-[120px] resize-y"
                        data-testid="textarea-system-prompt"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid="button-api-details"
                        >
                          <Info className="h-4 w-4 mr-2" />
                          API Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Current API Request Details</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          {lastApiRequest ? (
                            <>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-medium text-sm text-gray-600">Method</h4>
                                  <p className="font-mono text-sm bg-gray-100 p-2 rounded">{lastApiRequest.method}</p>
                                </div>
                                <div>
                                  <h4 className="font-medium text-sm text-gray-600">URL</h4>
                                  <p className="font-mono text-sm bg-gray-100 p-2 rounded">{lastApiRequest.url}</p>
                                </div>
                              </div>
                              <div>
                                <h4 className="font-medium text-sm text-gray-600">Timestamp</h4>
                                <p className="font-mono text-sm bg-gray-100 p-2 rounded">{lastApiRequest.timestamp}</p>
                              </div>
                              <div>
                                <h4 className="font-medium text-sm text-gray-600">Request Body</h4>
                                <pre className="font-mono text-sm bg-gray-100 p-3 rounded overflow-auto max-h-64">
                                  {JSON.stringify(lastApiRequest.body, null, 2)}
                                </pre>
                              </div>
                            </>
                          ) : (
                            <div className="text-center py-8">
                              <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
                              <p className="text-gray-500">No API requests made yet.</p>
                              <p className="text-sm text-gray-400 mt-2">Send a message or create a conversation to see API details.</p>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    <Button
                      onClick={handleUpdateSettings}
                      disabled={updateConversation.isPending}
                      size="sm"
                      data-testid="button-update-settings"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Update Settings
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <div className="flex-1 flex flex-col">
                {/* Messages Area */}
                  <CardContent className="flex-1 overflow-y-auto space-y-4 min-h-0">
                    {(!selectedConversation?.messages || selectedConversation.messages.length === 0) ? (
                      <div className="text-center text-gray-500 py-8">
                        <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Start a conversation with Gemini AI</p>
                      </div>
                    ) : (
                      selectedConversation.messages?.map((message, index) => (
                        <div
                          key={index}
                          className={`flex items-start gap-3 ${
                            message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                          }`}
                          data-testid={`message-${index}`}
                        >
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                            message.role === 'user' 
                              ? 'bg-blue-100 text-blue-600' 
                              : 'bg-purple-100 text-purple-600'
                          }`}>
                            {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                          </div>
                          <div className={`flex-1 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                            <div className={`relative group inline-block p-3 rounded-lg max-w-[80%] ${
                              message.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}>
                              <p className="whitespace-pre-wrap">{message.content}</p>
                              {message.role === 'assistant' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                                  onClick={() => handleCopyMessage(message.content, index)}
                                  data-testid={`button-copy-message-${index}`}
                                >
                                  {copiedMessageIndex === index ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {format(new Date(message.timestamp), 'HH:mm')}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </CardContent>

                {/* Message Input */}
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Textarea
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type your message here..."
                      className="flex-1 min-h-[60px] max-h-[120px]"
                      disabled={sendMessage.isPending}
                      data-testid="textarea-message"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!currentMessage.trim() || sendMessage.isPending}
                      size="lg"
                      data-testid="button-send-message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-purple-300" />
                <h3 className="text-xl font-medium mb-2">Welcome to Gemini AI Chat</h3>
                <p className="text-gray-500 mb-4">
                  Select a conversation from the sidebar or create a new one to get started.
                </p>
                <Button
                  onClick={handleQuickCreateConversation}
                  disabled={createConversation.isPending}
                  data-testid="button-start-new-chat"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Start New Chat
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}