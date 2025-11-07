import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Chatbot({ userRole, userName, isOpen, onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `${userRole}-${Date.now()}`);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      // Load chat history
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    try {
      const response = await axios.get(`${API}/chatbot/history/${sessionId}`);
      if (response.data.success && response.data.data.messages.length > 0) {
        setMessages(response.data.data.messages.map(m => ({
          role: m.role,
          content: m.content
        })));
      } else {
        // Add welcome message
        const welcomeMessage = userRole === 'admin'
          ? "Hello! I'm your waste management AI assistant. I can help you check bin statuses, view driver information, and automatically assign bins to drivers. What would you like to know?"
          : `Hello! I'm here to help you with your route. I can tell you about bins you've cleaned today, your pending bins, and your current task. What would you like to know?`;
        
        setMessages([{ role: 'assistant', content: welcomeMessage }]);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;

    const userMsg = inputMessage.trim();
    setInputMessage('');

    // Add user message to UI
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const response = await axios.post(`${API}/chatbot/chat`, {
        message: userMsg,
        session_id: sessionId,
        user_role: userRole,
        user_name: userName
      });

      if (response.data.success) {
        // Add AI response to UI
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: response.data.data.response }
        ]);
      } else {
        toast.error('Failed to get response');
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to send message');
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getSuggestedQuestions = () => {
    if (userRole === 'admin') {
      return [
        "Which bins are critical?",
        "Show available drivers",
        "Automatically assign bins to drivers",
        "What is the status of all bins?"
      ];
    } else {
      return [
        "How many bins did I clean today?",
        "What are my pending bins?",
        "What is my current route status?",
        "Show my task for today"
      ];
    }
  };

  const handleSuggestedQuestion = (question) => {
    setInputMessage(question);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 shadow-2xl">
      <Card className="border-2 border-teal-500">
        <CardHeader className="pb-3 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <CardTitle className="text-lg">AI Assistant</CardTitle>
                <p className="text-xs text-white/80">Powered by Emergent LLM</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="text-white hover:bg-white/20"
              data-testid="close-chatbot"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Messages Area */}
          <div className="h-96 overflow-y-auto p-4 bg-gray-50" data-testid="chat-messages">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.role === 'user'
                      ? 'bg-teal-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start mb-3">
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          {messages.length <= 1 && (
            <div className="px-4 py-2 bg-white border-t border-gray-200">
              <p className="text-xs text-gray-600 mb-2">Suggested questions:</p>
              <div className="flex flex-wrap gap-2">
                {getSuggestedQuestions().map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestedQuestion(question)}
                    className="text-xs px-3 py-1 bg-teal-50 text-teal-700 rounded-full hover:bg-teal-100 transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <form onSubmit={sendMessage} className="p-4 bg-white border-t border-gray-200">
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask me anything..."
                disabled={loading}
                className="flex-1"
                data-testid="chat-input"
              />
              <Button
                type="submit"
                disabled={loading || !inputMessage.trim()}
                className="bg-teal-600 hover:bg-teal-700"
                data-testid="send-message"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
