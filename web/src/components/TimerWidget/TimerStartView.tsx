/**
 * TimerStartView - Project selector and start button
 * Shows when timer is stopped
 */

import React, {useState} from 'react';
import {useData} from './DataProvider';
import {useTimerOperations} from '../../utils/timesheet-hooks';
import {useSendFollowUpMessage} from '../../hooks';
import ProjectSelector from './inputs/ProjectSelector';
import Spinner from '../shared/Spinner';
import FormattedMessage from '../shared/FormattedMessage';

export default function TimerStartView() {
  const {projects, selectedProject, setSelectedProject, reloadTimer} = useData();
  const timerOps = useTimerOperations();
  const sendFollowUpMessage = useSendFollowUpMessage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localSelectedProject, setLocalSelectedProject] = useState<string | null>(
    selectedProject
  );

  const handleStart = async () => {
    console.log('[TimerStartView] handleStart - clicked');
    setError(null);

    if (!localSelectedProject) {
      console.log('[TimerStartView] handleStart - no project selected');
      setError('Please select a project');
      return;
    }

    console.log('[TimerStartView] handleStart - starting timer for project:', localSelectedProject);
    setLoading(true);

    try {
      // Strip seconds and milliseconds from timestamps (matches web app behavior)
      const now = new Date();
      now.setSeconds(0, 0);
      const timestamp = now.toISOString();

      console.log('[TimerStartView] handleStart - calling timerOps.start with timestamp:', timestamp);
      const startedTimer = await timerOps.start({
        projectId: localSelectedProject,
        startDateTime: timestamp,
      });
      console.log('[TimerStartView] handleStart - timer started:', startedTimer);

      // Save selected project
      setSelectedProject(localSelectedProject);

      // Reload timer to get updated state
      console.log('[TimerStartView] handleStart - reloading timer');
      await reloadTimer();
      console.log('[TimerStartView] handleStart - timer reloaded');

      // Send follow-up message to chat
      const projectName = projects.find(p => p.id === localSelectedProject)?.title || 'project';
      console.log('[TimerStartView] handleStart - sending follow-up message for project:', projectName);
      sendFollowUpMessage(`Timer started for ${projectName}`);
    } catch (err) {
      console.error('[TimerStartView] Failed to start timer:', err);
      setError(err instanceof Error ? err.message : 'Failed to start timer');
    } finally {
      console.log('[TimerStartView] handleStart - done, loading=false');
      setLoading(false);
    }
  };

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="m-4">
      {(projects?.length || 0) > 0 ? (
        <div className="grid grid-cols-1 space-y-2">
          <ProjectSelector
            value={localSelectedProject}
            onChange={setLocalSelectedProject}
            error={error || undefined}
          />
          <button
            type="button"
            onClick={handleStart}
            disabled={loading}
            className="flex w-full items-center justify-center px-4 py-2 border border-transparent text-base text-center font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="uppercase">
              <FormattedMessage id="timerStart" defaultMessage="Start" />
            </span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 space-y-2">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <FormattedMessage
              id="timerNoProjectsYet"
              defaultMessage="You don't have any projects yet. Create your first one on timesheet.io"
            />
          </p>
        </div>
      )}
    </div>
  );
}
