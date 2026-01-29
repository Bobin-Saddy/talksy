import React, { useState, useEffect } from 'react';
import { RefreshCw, Calendar } from 'lucide-react';

const ChatAnalytics = () => {
  const [analytics, setAnalytics] = useState({
    totalConversations: 0,
    resolutionRate: 0,
    assistedRevenue: 0,
    chatToSalesRate: 0,
    totalSalesShare: 0,
    loading: true
  });

  const [dateRange, setDateRange] = useState('Last 3 days');
  const [setupProgress, setSetupProgress] = useState(3);
  const [totalTasks, setTotalTasks] = useState(11);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      // Replace with your actual API endpoint
      const response = await fetch('/api/chat-analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dateRange })
      });
      
      const data = await response.json();
      
      setAnalytics({
        totalConversations: data.totalConversations || 0,
        resolutionRate: data.resolutionRate || 0,
        assistedRevenue: data.assistedRevenue || 0,
        chatToSalesRate: data.chatToSalesRate || 0,
        totalSalesShare: data.totalSalesShare || 0,
        loading: false
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setAnalytics(prev => ({ ...prev, loading: false }));
    }
  };

  const handleReload = () => {
    setAnalytics(prev => ({ ...prev, loading: true }));
    fetchAnalytics();
  };

  const MetricCard = ({ title, value, prefix = '', suffix = '' }) => (
    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
      <div className="text-sm text-gray-600 mb-2">{title}</div>
      <div className="text-3xl font-semibold text-gray-900">
        {prefix}{value}{suffix}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>
          <button 
            onClick={handleReload}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={analytics.loading}
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${analytics.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg">
            <Calendar className="w-4 h-4" />
            <span>{dateRange}</span>
          </div>
          <span>Compare to: 24 Jan - 26 Jan 2026</span>
          <span className="ml-auto text-gray-500">Updated 33m ago</span>
          <button className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            <RefreshCw className="w-4 h-4" />
            Reload
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <MetricCard 
          title="Total conversations" 
          value={analytics.totalConversations}
        />
        <MetricCard 
          title="Resolution rate" 
          value={analytics.resolutionRate}
          suffix="%"
        />
        <MetricCard 
          title="Assisted revenue" 
          value={analytics.assistedRevenue}
          prefix="₹"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <MetricCard 
          title="Chat-to-sales rate" 
          value={analytics.chatToSalesRate}
          suffix="%"
        />
        <MetricCard 
          title="Total sales share contributed by Chatty" 
          value={analytics.totalSalesShare}
          suffix="%"
        />
      </div>

      {/* Setup Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Set up live chat</h2>
            <p className="text-sm text-gray-600">Use this guide to start setup app on your store</p>
          </div>
          <button className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">{setupProgress} of {totalTasks} tasks completed</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gray-900 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(setupProgress / totalTasks) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="space-y-2">
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer py-3 px-4 hover:bg-gray-50 rounded-lg">
              <span className="font-medium text-gray-900">Set up live chat</span>
              <svg className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
          </details>
          
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer py-3 px-4 hover:bg-gray-50 rounded-lg">
              <span className="font-medium text-gray-900">Set up AI assistant</span>
              <svg className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
          </details>
          
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer py-3 px-4 hover:bg-gray-50 rounded-lg">
              <span className="font-medium text-gray-900">Set up FAQs</span>
              <svg className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
          </details>
        </div>

        <button className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Let us set up for you
        </button>
      </div>

      {/* Suggest Features Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Suggest Features</h2>
        <p className="text-sm text-gray-600 mb-4">Share your feature ideas</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
            <input 
              type="text"
              placeholder="Name your feature"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea 
              placeholder="How would this feature help you?"
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            ></textarea>
          </div>
          
          <button className="w-full bg-blue-700 hover:bg-blue-800 text-white font-medium py-3 px-6 rounded-lg transition-colors">
            Add idea
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatAnalytics;