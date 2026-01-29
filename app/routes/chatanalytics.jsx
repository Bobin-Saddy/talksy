import { useEffect, useState } from "react";

export default function ChatAnalytics() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>

            <button
              onClick={() => setLoading(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {loading ? "Refreshing..." : "Reload"}
            </button>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg">
              📅 <span className="text-gray-700">Last 3 days</span>
            </div>
            <span className="text-gray-600">Compare to: 24 Jan - 26 Jan 2026</span>
            <span className="ml-auto text-gray-500">Updated 33m ago</span>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white rounded-lg p-6 border">
            <p className="text-sm text-gray-600 mb-2">Total conversations</p>
            <h2 className="text-3xl font-semibold">0</h2>
          </div>

          <div className="bg-white rounded-lg p-6 border">
            <p className="text-sm text-gray-600 mb-2">Resolution rate</p>
            <h2 className="text-3xl font-semibold">0%</h2>
          </div>

          <div className="bg-white rounded-lg p-6 border">
            <p className="text-sm text-gray-600 mb-2">Assisted revenue</p>
            <h2 className="text-3xl font-semibold">₹0</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg p-6 border">
            <p className="text-sm text-gray-600 mb-2">Chat-to-sales rate</p>
            <h2 className="text-3xl font-semibold">0%</h2>
          </div>

          <div className="bg-white rounded-lg p-6 border">
            <p className="text-sm text-gray-600 mb-2">Total sales share by Chatty</p>
            <h2 className="text-3xl font-semibold">0%</h2>
          </div>
        </div>

        {/* Setup Section */}
        <div className="bg-white rounded-lg p-6 border mb-6">
          <h2 className="text-lg font-semibold mb-2">Set up live chat</h2>
          <p className="text-sm text-gray-600 mb-4">3 of 11 tasks completed</p>

          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div className="bg-black h-2 rounded-full" style={{ width: "30%" }}></div>
          </div>

          <div className="space-y-2">
            <div className="p-3 border rounded">Set up live chat</div>
            <div className="p-3 border rounded">Set up AI assistant</div>
            <div className="p-3 border rounded">Set up FAQs</div>
          </div>
        </div>

        {/* Suggest Feature */}
        <div className="bg-white rounded-lg p-6 border">
          <h2 className="text-lg font-semibold mb-4">Suggest Features</h2>

          <input
            className="w-full border p-2 rounded mb-3"
            placeholder="Feature title"
          />

          <textarea
            className="w-full border p-2 rounded mb-3"
            rows="4"
            placeholder="Feature description"
          ></textarea>

          <button className="w-full bg-blue-600 text-white p-3 rounded">
            Add idea
          </button>
        </div>

      </div>
    </div>
  );
}
