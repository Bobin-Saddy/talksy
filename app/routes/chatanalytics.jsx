import { useState, useEffect, useCallback } from 'react';

// Inline SVG Icons
const RefreshIcon = ({ className = '', spinning = false }) => (
  <svg
    className={`${className} ${spinning ? 'animate-spin' : ''}`}
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
);

const CalendarIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

const ChevronDownIcon = ({ className = '' }) => (
  <svg
    className={className}
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

const HelpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

export default function ChatAnalytics() {
  const [analytics, setAnalytics] = useState({
    totalConversations: 0,
    resolutionRate: 0,
    assistedRevenue: 0,
    chatToSalesRate: 0,
    totalSalesShare: 0,
    loading: true,
  });

  const [dateRange] = useState('Last 3 days');
  const [setupProgress] = useState({ completed: 3, total: 11 });
  const [liveChatOpen, setLiveChatOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [featureTitle, setFeatureTitle] = useState('');
  const [featureDescription, setFeatureDescription] = useState('');

  const fetchAnalytics = useCallback(async () => {
    try {
      setAnalytics((prev) => ({ ...prev, loading: true }));

      const response = await fetch('/api/chat-analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dateRange }),
      });

      const data = await response.json();

      setAnalytics({
        totalConversations: data.totalConversations || 0,
        resolutionRate: data.resolutionRate || 0,
        assistedRevenue: data.assistedRevenue || 0,
        chatToSalesRate: data.chatToSalesRate || 0,
        totalSalesShare: data.totalSalesShare || 0,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setAnalytics((prev) => ({ ...prev, loading: false }));
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleReload = useCallback(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleSubmitFeature = useCallback(() => {
    if (!featureTitle || !featureDescription) {
      return;
    }

    // Handle feature submission
    console.log('Feature submitted:', { featureTitle, featureDescription });

    // Reset form
    setFeatureTitle('');
    setFeatureDescription('');
  }, [featureTitle, featureDescription]);

  const progressPercent = (setupProgress.completed / setupProgress.total) * 100;

  const MetricCard = ({ title, value, prefix = '', suffix = '' }) => (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <p className="text-sm text-gray-600 mb-2">{title}</p>
      <h2 className="text-3xl font-semibold text-gray-900">
        {prefix}
        {value}
        {suffix}
      </h2>
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>
            <button
              onClick={handleReload}
              disabled={analytics.loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshIcon spinning={analytics.loading} />
              Reload
            </button>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg">
              <CalendarIcon />
              <span className="text-gray-700">{dateRange}</span>
            </div>
            <span className="text-gray-600">Compare to: 24 Jan - 26 Jan 2026</span>
            <span className="ml-auto text-gray-500">Updated 33m ago</span>
          </div>
        </div>

        {/* Metrics Grid - Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <MetricCard title="Total conversations" value={analytics.totalConversations} />
          <MetricCard title="Resolution rate" value={analytics.resolutionRate} suffix="%" />
          <MetricCard title="Assisted revenue" value={analytics.assistedRevenue} prefix="₹" />
        </div>

        {/* Metrics Grid - Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <MetricCard title="Chat-to-sales rate" value={analytics.chatToSalesRate} suffix="%" />
          <MetricCard
            title="Total sales share contributed by Chatty"
            value={analytics.totalSalesShare}
            suffix="%"
          />
        </div>

        {/* Setup Section */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Set up live chat</h2>
            <p className="text-sm text-gray-600">
              Use this guide to start setup app on your store
            </p>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">
              {setupProgress.completed} of {setupProgress.total} tasks completed
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gray-900 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-2">
            {/* Set up live chat */}
            <div>
              <button
                onClick={() => setLiveChatOpen(!liveChatOpen)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <span className="font-medium text-gray-900">Set up live chat</span>
                <ChevronDownIcon
                  className={`transform transition-transform ${
                    liveChatOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {liveChatOpen && (
                <div className="px-3 py-2 text-sm text-gray-600">
                  Configure your live chat settings and appearance.
                </div>
              )}
            </div>

            {/* Set up AI assistant */}
            <div>
              <button
                onClick={() => setAiAssistantOpen(!aiAssistantOpen)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <span className="font-medium text-gray-900">Set up AI assistant</span>
                <ChevronDownIcon
                  className={`transform transition-transform ${
                    aiAssistantOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {aiAssistantOpen && (
                <div className="px-3 py-2 text-sm text-gray-600">
                  Configure AI responses and automation rules.
                </div>
              )}
            </div>

            {/* Set up FAQs */}
            <div>
              <button
                onClick={() => setFaqOpen(!faqOpen)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <span className="font-medium text-gray-900">Set up FAQs</span>
                <ChevronDownIcon
                  className={`transform transition-transform ${faqOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {faqOpen && (
                <div className="px-3 py-2 text-sm text-gray-600">
                  Add frequently asked questions and answers.
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-4">
            <button className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <HelpIcon />
              Let us set up for you
            </button>
          </div>
        </div>

        {/* Suggest Features Section */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Suggest Features</h2>
            <p className="text-sm text-gray-600">Share your feature ideas</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
              <input
                type="text"
                value={featureTitle}
                onChange={(e) => setFeatureTitle(e.target.value)}
                placeholder="Name your feature"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={featureDescription}
                onChange={(e) => setFeatureDescription(e.target.value)}
                placeholder="How would this feature help you?"
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              ></textarea>
            </div>

            <button
              onClick={handleSubmitFeature}
              disabled={!featureTitle || !featureDescription}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add idea
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}