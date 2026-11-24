---
title: Hosting and Deployment
summary: Long-running servers vs serverless vs containers vs edge; comparing hosts; environments, CI/CD, deploy strategies, zero-downtime migrations and cost thinking.
difficulty: beginner
minutes: 35
source: backend/09-hosting-and-deployment.md
prerequisites: [http-deep-dive]
objectives:
  - Choose between servers, serverless, containers and edge functions for a workload
  - Set up separate environments and a basic CI/CD flow
  - Compare rolling, blue-green and canary deployments
  - Reason about hosting cost at different scales
videos:
  - id: Gjnup-PuquQ
    title: Docker in 100 Seconds
    channel: Fireship
    why: A quick picture of what a container is before comparing hosting models.
resources:
  - url: https://12factor.net/
    title: The Twelve-Factor App
    why: The classic principles (config in env, stateless processes, disposability) behind portable deployments.
  - url: https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html
    title: AWS Lambda execution environment lifecycle
    why: Explains cold starts, init and freeze, which are central to the serverless trade-offs.
  - url: https://martinfowler.com/bliki/BlueGreenDeployment.html
    title: "Martin Fowler: Blue-Green Deployment"
    why: The original short description of blue-green deploys and their database caveats.
quiz:
  - type: scenario
    q: A webhook receiver gets a few hundred requests a day in random bursts. Which hosting model is most cost-effective?
    options: ["A dedicated always-on VM", "Serverless functions", "A Kubernetes cluster", "Bare metal"]
    answer: 1
    explain: Spiky, low-volume traffic is where pay-per-invocation shines. You pay nothing while idle; cold starts are acceptable for webhooks.
  - type: mcq
    q: In a canary deployment you…
    options: ["Deploy to all servers at once", "Send a small percentage of traffic to the new version, watch metrics, then increase", "Keep two full environments and flip DNS", "Deploy only at night"]
    answer: 1
    explain: "Canaries limit the blast radius: if errors or latency rise for the small slice, roll back before most users notice. Blue-green is the two-environments flip."
  - type: tf
    q: Long-lived WebSocket connections are a natural fit for classic request-scoped serverless functions.
    answer: 1
    explain: False. Classic functions are request-scoped with execution time limits. Persistent connections usually need servers or containers, or a managed WebSocket gateway in front of functions.
---

## Hands-on exercise

Deploy the same tiny API two ways, both on free tiers: once as a container on a platform such as Render, Railway or Fly.io, and once as a serverless function (Vercel, Netlify or Cloudflare Workers). For each, record cold-start latency (first request after 15 minutes idle), warm latency, deploy time, and how you set an environment variable and see logs. Use numbers you measured.

## Completion criteria

- You've deployed to two hosting models and can compare them from experience.
