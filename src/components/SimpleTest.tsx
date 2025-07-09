const SimpleTest = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center p-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          App is Working!
        </h1>
        <p className="text-gray-600 mb-4">
          This is a simple test component to verify the app structure is working.
        </p>
        <div className="space-y-2">
          <p className="text-sm text-green-600">✓ React is rendering</p>
          <p className="text-sm text-green-600">✓ Tailwind CSS is working</p>
          <p className="text-sm text-green-600">✓ Components are loading</p>
        </div>
      </div>
    </div>
  );
};

export default SimpleTest;
