const fs = require('fs');

const getValues = (path = '.env') => {
  if (process.env.FAKE_ENV) return {};
  return fs
    .readFileSync(path, {encoding: 'utf-8'})
    .trim()
    .split('\n')
    .map(line => line.split(/=(.*)/))
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
};

class ServerlessOfflineSSMProvider {
  constructor(serverless) {
    this.serverless = serverless;
    this.config = this.serverless.service.custom['serverless-offline-ssm-provider'];
    try {
      this.values = this.config ? getValues(this.config.file) : getValues();

      const aws = this.serverless.getProvider('aws');
      const request = aws.request.bind(aws);

      aws.request = (service, method, params, options) => {
        if (service !== 'SSM' || method !== 'getParameter')
          return request(service, method, params, options);

        const {Name} = params;
        let Value = this.values[Name];
        if (Value === undefined) return request(service, method, params, options);
        return Promise.resolve({
          Parameter: {
            Value
          }
        });
      };

      this.serverless.setProvider('aws', aws);
      console.log('Mock ssm provider set up');
    } catch (e) {
      if (e.code === 'ENOENT') {
        console.log('Skipping serverless-offline-ssm-provider as env file cannot be found')
      } else {
        console.error(e);
      }
    }
  }
}

module.exports = ServerlessOfflineSSMProvider;
