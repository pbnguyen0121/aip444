# Week 5 Notes - Structured Outputs

LLMs are non-deterministic, which means they can produce different responses for the same prompt.

Structured Outputs help applications receive reliable JSON data from an LLM.

A schema is a contract that defines the expected shape and data types of a response.

Zod is a TypeScript schema validation library that can define schemas in code and validate data at runtime.

Structured Outputs solve formatting problems, but they do not guarantee that the content is factually correct.

When using structured outputs, schema descriptions help guide the model toward better responses.
