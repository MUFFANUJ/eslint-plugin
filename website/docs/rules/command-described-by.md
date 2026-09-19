# `command-described-by`

Ensure JupyterLab command registrations include a `describedBy` property.

## Incorrect

```ts
app.commands.addCommand(CommandIDs.test, {
  label: 'Test Command',
  execute: args => {
    console.log(args.value);
  }
});
```

## Correct

```ts
app.commands.addCommand(CommandIDs.test, {
  label: 'Test Command',
  execute: args => {
    console.log(args.value);
  },
  describedBy: {
    args: {
      type: 'object',
      properties: {
        value: { type: 'string' }
      }
    }
  }
});
```

## Why

Command argument metadata tells callers which values a command accepts. For example, the schema above describes `value` as a string. Add `describedBy` when registering a command with an `execute` function.

## Options

This rule has no options.
