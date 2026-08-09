import { runWorkflowContinueStep } from '../lib/workflow/runContinueStep'

runWorkflowContinueStep()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2))
  })
  .catch(console.error)
