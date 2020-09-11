# biometrics-liveness_passive



<!-- Auto Generated Below -->


## Properties

| Property           | Attribute            | Description | Type     | Default     |
| ------------------ | -------------------- | ----------- | -------- | ----------- |
| `apiKey`           | `api-key`            |             | `string` | `undefined` |
| `maxPictureHeight` | `max-picture-height` |             | `number` | `600`       |
| `maxPictureWidth`  | `max-picture-width`  |             | `number` | `720`       |
| `serverUrl`        | `server-url`         |             | `string` | `undefined` |


## Events

| Event                          | Description | Type               |
| ------------------------------ | ----------- | ------------------ |
| `livenessVerificationComplete` |             | `CustomEvent<any>` |


## Dependencies

### Depends on

- [biometrics-camera](../camera)

### Graph
```mermaid
graph TD;
  biometrics-liveness-passive --> biometrics-camera
  style biometrics-liveness-passive fill:#f9f,stroke:#333,stroke-width:4px
```

----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
