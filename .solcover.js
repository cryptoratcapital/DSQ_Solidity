module.exports = {
  skipFiles: ["/test", "/interfaces", "/trader/external"],
  mocha: {
    grep: "@skip-on-coverage", // Find everything with this tag
    invert: true, // Run the grep's inverse set.
  },
};
