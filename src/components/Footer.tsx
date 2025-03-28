const Footer = () => {
  // Get the git commit hash from the environment variable
  const commitHash = import.meta.env.VITE_GIT_COMMIT_HASH || 'development';

  return (
    <footer className="py-4 w-full text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700"
      style={{
        fontSize: '90%',
        marginBottom: '1em'
      }}
    >
      <div style={{ textAlign: 'center' }}>
        Powered by 🐼 <a
          href="https://github.com/ethpandaops/hive-ui"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ethpandaops/hive-ui
        </a>
        <span className="mx-2">•</span>
        <span title="Git commit"><code style={{
          marginLeft: '0.4em',
          padding: '0.2em 0.4em',
          backgroundColor: 'rgba(175, 184, 193, 0.2)',
          borderRadius: '6px'
        }}>{commitHash}</code></span>
      </div>
    </footer>
  );
};

export default Footer;
