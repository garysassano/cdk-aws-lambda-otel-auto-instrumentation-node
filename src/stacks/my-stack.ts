import { Duration, Stack, StackProps } from "aws-cdk-lib";
import {
  Architecture,
  LayerVersion,
  LoggingFormat,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { join } from "path";
import { validateEnv } from "../utils/validate-env";

const env = validateEnv(["HONEYCOMB_API_KEY"]);

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const otelCollectorLayer = LayerVersion.fromLayerVersionArn(
      this,
      "OtelCollectorLayer",
      `arn:aws:lambda:${this.region}:184161586896:layer:opentelemetry-collector-arm64-0_13_0:1`,
    );
    const otelNodeLayer = LayerVersion.fromLayerVersionArn(
      this,
      "OtelNodeLayer",
      `arn:aws:lambda:${this.region}:184161586896:layer:opentelemetry-nodejs-0_13_0:1`,
    );

    new NodejsFunction(this, "OtelHelloLambda", {
      functionName: "otel-hello-lambda",
      entry: join(__dirname, "../functions/hello", "index.ts"),
      layers: [otelCollectorLayer, otelNodeLayer],
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      timeout: Duration.minutes(1),
      memorySize: 1024,
      loggingFormat: LoggingFormat.JSON,
      environment: {
        // OTel Collector Extension
        AWS_LAMBDA_EXEC_WRAPPER: "/opt/otel-handler",
        OPENTELEMETRY_EXTENSION_LOG_LEVEL: "WARN",
        // OTel Collector
        HONEYCOMB_API_KEY: env.HONEYCOMB_API_KEY,
        OPENTELEMETRY_COLLECTOR_CONFIG_URI:
          "file:/var/task/collector-confmap.yml",
        // OTel SDK
        OTEL_LOGS_EXPORTER: "none",
        OTEL_METRICS_EXPORTER: "none",
        OTEL_SERVICE_NAME: "otel-hello-lambda",
      },
      bundling: {
        commandHooks: {
          beforeBundling() {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            return [
              `cp ${inputDir}/src/otel/collector-confmap.yml ${outputDir}`,
            ];
          },
          beforeInstall() {
            return [];
          },
        },
      },
    });
  }
}
