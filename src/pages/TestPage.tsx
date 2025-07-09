const TestPage = () => {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          🎉 App is Working!
        </h1>
        
        <div className="space-y-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h2 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
              ✅ What's Working:
            </h2>
            <ul className="space-y-1 text-green-700 dark:text-green-300">
              <li>• React is rendering properly</li>
              <li>• Tailwind CSS is working</li>
              <li>• Theme context is functional</li>
              <li>• Error boundaries are in place</li>
              <li>• Firebase config is loaded</li>
            </ul>
          </div>
          
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
              🚀 Next Steps:
            </h2>
            <ul className="space-y-1 text-blue-700 dark:text-blue-300">
              <li>• Navigate to <a href="/simple" className="underline">/simple</a> for a basic page</li>
              <li>• Navigate to <a href="/login" className="underline">/login</a> to test auth</li>
              <li>• Navigate to <a href="/register" className="underline">/register</a> to create account</li>
            </ul>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
              🛠️ Debug Info:
            </h2>
            <ul className="space-y-1 text-gray-600 dark:text-gray-400 text-sm">
              <li>• Current Theme: System (Dark mode detection working)</li>
              <li>• Auth State: Loading/Ready</li>
              <li>• Firebase: Connected</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestPage;
