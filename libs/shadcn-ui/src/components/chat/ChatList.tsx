import React from 'react';
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { IoMdAdd } from "react-icons/io";
import { FaRegClock, FaTrash } from "react-icons/fa";
import { formatDistanceToNow } from 'date-fns';

// Define Chat interface locally to avoid import issues
export interface Chat {
  id: string;
  name?: string;
  lastMessage?: string;
  updatedAt: string;
  createdAt: string;
  assistantId: string;
}

interface ChatListProps {
  chats: Chat[];
  isLoading: boolean;
  onSelectChat: (chatId: string) => void;
  onDeleteChat?: (chatId: string) => Promise<void>;
  onNewChat?: () => void;
  onClose?: () => void;
}

/**
 * ChatList component displays a list of chat conversations
 */
export function ChatList({ chats, isLoading, onSelectChat, onDeleteChat, onNewChat, onClose }: ChatListProps) {
  // Handle selecting a chat
  const handleSelectChat = (chatId: string) => {
    onSelectChat(chatId);
  };

  // Handle starting a new chat
  const handleNewChat = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onNewChat) {
      onNewChat();
    }
  };

  // Handle deleting a chat
  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation(); // Prevent triggering the chat selection
    if (onDeleteChat) {
      await onDeleteChat(chatId);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background rounded-lg shadow-lg">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex space-x-2">
          {onNewChat && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={(e) => handleNewChat(e)}
              className="h-8 px-2 mr-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M12 5v14M5 12h14"></path></svg>
              New
            </Button>
          )}
          {onClose && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="h-7 w-7 rounded-full"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
            </Button>
          )}
        </div>
      </div>
      
      {/* Chat List */}
      <ScrollArea className="flex-1 p-2">
        {isLoading && chats.length === 0 ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            <p className="mb-2">No previous conversations found</p>
            {onNewChat && (
              <Button 
                size="sm" 
                onClick={handleNewChat}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                <IoMdAdd size={18} className="mr-1" />
                Start First Chat
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {chats.map((chat) => (
              <Card 
                key={chat.id}
                className="cursor-pointer hover:bg-muted transition-colors"
                onClick={() => handleSelectChat(chat.id)}
              >
                <CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium truncate">
                        {chat.name || 'Conversation'}
                      </h3>
                      {chat.lastMessage && (
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {chat.lastMessage}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center ml-2">
                      <div className="text-xs text-muted-foreground flex items-center whitespace-nowrap mr-2">
                        <FaRegClock className="mr-1" size={12} />
                        {formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: true })}
                      </div>
                      {onDeleteChat && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full hover:bg-destructive hover:text-destructive-foreground"
                          onClick={(e) => handleDeleteChat(e, chat.id)}
                          title="Delete chat"
                        >
                          <FaTrash size={12} />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
