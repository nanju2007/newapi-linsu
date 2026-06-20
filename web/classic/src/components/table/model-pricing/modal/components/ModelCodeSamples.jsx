/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useMemo, useState } from 'react';
import { Avatar, Typography, Tabs, TabPane, Button } from '@douyinfe/semi-ui';
import { Braces, Copy } from 'lucide-react';
import { copy, removeTrailingSlash, showSuccess } from '../../../../../helpers';

const { Text } = Typography;

const getBaseUrl = () => {
  if (typeof window === 'undefined') return '';
  return removeTrailingSlash(window.location.origin || '');
};

const getPrimaryEndpoint = (modelData, endpointMap) => {
  const types = modelData?.supported_endpoint_types || [];
  const preferred = [
    'openai-chat-completions',
    'openai-response',
    'anthropic-messages',
    'gemini-generate-content',
    'openai-embeddings',
  ];
  const chosen = preferred.find((item) => types.includes(item)) || types[0];
  const info = endpointMap?.[chosen] || {};
  let path = info.path || '/v1/chat/completions';
  if (path.includes('{model}')) {
    path = path.replaceAll('{model}', modelData?.model_name || '');
  }
  return {
    endpointType: chosen,
    path,
  };
};

const buildCurlSample = (modelName, endpointType, url) => {
  if (endpointType === 'anthropic-messages') {
    return `curl ${url} \\
  -H "x-api-key: <YOUR_API_KEY>" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;
  }

  if (endpointType === 'gemini-generate-content') {
    return `curl "${url}?key=<YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contents": [{"parts": [{"text": "Hello!"}]}]
  }'`;
  }

  if (endpointType === 'openai-embeddings') {
    return `curl ${url} \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "input": "The food was delicious"
  }'`;
  }

  if (endpointType === 'openai-response') {
    return `curl ${url} \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "input": "Hello!"
  }'`;
  }

  return `curl ${url} \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;
};

const buildPythonSample = (modelName, endpointType, baseUrl) => {
  if (endpointType === 'anthropic-messages') {
    return `import anthropic

client = anthropic.Anthropic(
    base_url="${baseUrl}",
    api_key="<YOUR_API_KEY>",
)

message = client.messages.create(
    model="${modelName}",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}],
)

print(message.content[0].text)`;
  }

  if (endpointType === 'gemini-generate-content') {
    return `import google.generativeai as genai

genai.configure(api_key="<YOUR_API_KEY>")
model = genai.GenerativeModel("${modelName}")
response = model.generate_content("Hello!")

print(response.text)`;
  }

  if (endpointType === 'openai-embeddings') {
    return `from openai import OpenAI

client = OpenAI(base_url="${baseUrl}/v1", api_key="<YOUR_API_KEY>")

response = client.embeddings.create(
    model="${modelName}",
    input="The food was delicious",
)

print(response.data[0].embedding[:8])`;
  }

  if (endpointType === 'openai-response') {
    return `from openai import OpenAI

client = OpenAI(base_url="${baseUrl}/v1", api_key="<YOUR_API_KEY>")

response = client.responses.create(
    model="${modelName}",
    input="Hello!",
)

print(response.output_text)`;
  }

  return `from openai import OpenAI

client = OpenAI(base_url="${baseUrl}/v1", api_key="<YOUR_API_KEY>")

completion = client.chat.completions.create(
    model="${modelName}",
    messages=[
        {"role": "user", "content": "Hello!"}
    ],
)

print(completion.choices[0].message.content)`;
};

const buildNodeSample = (modelName, endpointType, baseUrl) => {
  if (endpointType === 'anthropic-messages') {
    return `import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  baseURL: '${baseUrl}',
  apiKey: process.env.NEWAPI_API_KEY,
})

const message = await client.messages.create({
  model: '${modelName}',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }],
})

console.log(message.content[0].text)`;
  }

  if (endpointType === 'gemini-generate-content') {
    return `import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.NEWAPI_API_KEY)
const model = genAI.getGenerativeModel({ model: '${modelName}' })
const result = await model.generateContent('Hello!')

console.log(result.response.text())`;
  }

  if (endpointType === 'openai-embeddings') {
    return `import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: '${baseUrl}/v1',
  apiKey: process.env.NEWAPI_API_KEY,
})

const response = await client.embeddings.create({
  model: '${modelName}',
  input: 'The food was delicious',
})

console.log(response.data[0].embedding.slice(0, 8))`;
  }

  if (endpointType === 'openai-response') {
    return `import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: '${baseUrl}/v1',
  apiKey: process.env.NEWAPI_API_KEY,
})

const response = await client.responses.create({
  model: '${modelName}',
  input: 'Hello!',
})

console.log(response.output_text)`;
  }

  return `import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: '${baseUrl}/v1',
  apiKey: process.env.NEWAPI_API_KEY,
})

const completion = await client.chat.completions.create({
  model: '${modelName}',
  messages: [{ role: 'user', content: 'Hello!' }],
})

console.log(completion.choices[0].message.content)`;
};

const CodeBlock = ({ code, onCopy, t }) => (
  <div className='rounded-xl overflow-hidden border border-slate-300 bg-slate-950 shadow-sm'>
    <div className='flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-700'>
      <span className='text-xs text-slate-200 font-medium'>API Sample</span>
      <Button
        size='small'
        theme='borderless'
        style={{ color: '#e2e8f0' }}
        icon={<Copy size={14} color='#e2e8f0' />}
        onClick={onCopy}
      >
        {t('复制')}
      </Button>
    </div>
    <pre
      className='m-0 p-4 overflow-x-auto text-xs leading-6'
      style={{
        color: '#f8fafc',
        background: '#020617',
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace',
      }}
    >
      <code>{code}</code>
    </pre>
  </div>
);

const ModelCodeSamples = ({ modelData, endpointMap, t }) => {
  const [lang, setLang] = useState('curl');

  const sampleInfo = useMemo(() => {
    const baseUrl = getBaseUrl();
    const endpoint = getPrimaryEndpoint(modelData, endpointMap);
    const url = `${baseUrl}${endpoint.path}`;
    const modelName = modelData?.model_name || '';

    return {
      curl: buildCurlSample(modelName, endpoint.endpointType, url),
      python: buildPythonSample(modelName, endpoint.endpointType, baseUrl),
      node: buildNodeSample(modelName, endpoint.endpointType, baseUrl),
    };
  }, [modelData, endpointMap]);

  const handleCopy = async () => {
    if (await copy(sampleInfo[lang])) {
      showSuccess(t('复制成功'));
    }
  };

  return (
    <div>
      <div className='flex items-center mb-4'>
        <Avatar size='small' color='blue' className='mr-2 shadow-md'>
          <Braces size={16} />
        </Avatar>
        <div>
          <Text className='text-lg font-medium'>{t('模型调用代码')}</Text>
          <div className='text-xs text-gray-600'>
            {t('基于当前模型支持的端点生成可直接参考的调用示例')}
          </div>
        </div>
      </div>

      <Tabs type='button' activeKey={lang} onChange={setLang} className='mb-3'>
        <TabPane tab='cURL' itemKey='curl' />
        <TabPane tab='Python' itemKey='python' />
        <TabPane tab='Node.js' itemKey='node' />
      </Tabs>

      <CodeBlock code={sampleInfo[lang]} onCopy={handleCopy} t={t} />
    </div>
  );
};

export default ModelCodeSamples;
