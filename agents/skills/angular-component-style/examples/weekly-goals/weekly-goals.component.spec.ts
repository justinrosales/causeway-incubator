import { render, waitFor, waitForElementToBeRemoved, within, screen, fireEvent } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { WeeklyGoalsComponent } from './weekly-goals.component';
import { WeeklyGoalsModalComponent } from './weekly-goals-modal/weekly-goals-modal.component';
import { WeeklyGoalItemComponent } from './weekly-goal-item/weekly-goal-item.component';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { DATABASE_SERVICE } from 'src/app/core/firebase/database.service';
import { FirebaseMockService } from 'src/app/core/firebase/firebase.mock.service';
import { BATCH_WRITE_SERVICE } from 'src/app/core/store/batch-write.service';
import { BatchWriteMockService } from 'src/app/core/store/batch-write.mock.service';
import { WeeklyGoalStore } from 'src/app/core/store/weekly-goal/weekly-goal.store';
import { QuarterlyGoalStore } from 'src/app/core/store/quarterly-goal/quarterly-goal.store';
import { HashtagStore } from 'src/app/core/store/hashtag/hashtag.store';
import { AuthStore } from 'src/app/core/store/auth/auth.store';
import { WEEKLYGOAL_DB } from 'src/app/core/store/weekly-goal/weekly-goal.mock';
import { AuthLoggedInMockDB } from 'src/app/core/store/auth/auth.mock';
import { Provider } from '@angular/core';
import { InteractivityChecker } from '@angular/cdk/a11y';

/**
 * Sets up a testing environment for a WeeklyGoalsComponent.
 * @param providers - Optional additional providers to override defaults (e.g. for error states or empty data)
 */
async function setup(providers: Provider[] = []) {
  const user = userEvent.setup();
  const goalClicked = jest.fn();

  const view = await render(WeeklyGoalsComponent, {
    on: { goalClicked },
    imports: [
      WeeklyGoalsComponent,
      WeeklyGoalsModalComponent,
      WeeklyGoalItemComponent,
      MatDialogModule,
      MatSelectModule,
      MatSnackBarModule,
      ReactiveFormsModule,
      FormsModule,
      NoopAnimationsModule,
    ],
    providers: [
      { provide: MatDialogRef, useValue: { close: jest.fn() } },
      { provide: DATABASE_SERVICE, useClass: FirebaseMockService },
      { provide: BATCH_WRITE_SERVICE, useClass: BatchWriteMockService },
      { provide: AuthStore, useClass: AuthLoggedInMockDB },
      {
        provide: InteractivityChecker,
        useValue: {
          isFocusable: () => true,
        },
      },
      WeeklyGoalStore,
      QuarterlyGoalStore,
      HashtagStore,
      ...providers, // Allow individual tests to override the providers above
    ],
  });

  return { user, fixture: view.fixture, goalClicked };
}

/**
 * This test suite tests the UI implementation of the Weekly Goals Card, and
 * subsequently the Weekly Goals Item and Weekly Goals Modal for full code coverage.
 *
 * Attached is helpful documentation from the Angular Testing Library for reference on how you should approach testing.
 * @see https://github.com/testing-library/angular-testing-library/blob/d4d45679a1cc4176439b1f4946dae55ae7c0bd98/apps/example-app/src/app/examples/15-dialog.component.spec.ts
 * @see https://github.com/testing-library/angular-testing-library/blob/main/apps/example-app/src/app/examples/04-forms-with-material.spec.ts
 * @see https://github.com/testing-library/angular-testing-library/blob/d4d45679a1cc4176439b1f4946dae55ae7c0bd98/apps/example-app/src/app/examples/02-input-output.spec.ts
 *
 */
describe('WeeklyGoalsComponent Integration Tests', () => {
  it('loads and renders correct goals, toggles completion, edits via modal (add/edit/delete), saves, and emits goal click', async () => {
    const { user, fixture, goalClicked } = await setup();

    for (const goal of WEEKLYGOAL_DB) {
      expect(await screen.findByText(goal.text)).toBeVisible();
    }

    const firstGoalText = WEEKLYGOAL_DB[0].text;
    await user.click(screen.getByText(firstGoalText));
    expect(goalClicked).toHaveBeenCalledTimes(1);

    // --- OPEN MODAL ---
    user.click(await screen.findByRole('button', { name: /Add/i }));
    const dialog = await screen.findByRole('dialog');
    const saveBtn = within(dialog).getByRole('button', { name: /Save/i });

    // --- DELETE 1st GOAL ---
    const trashIcons = within(dialog).getAllByLabelText('trash icon');
    await user.click(trashIcons[0]);
    expect(within(dialog).getByText(/Deleting 1/i)).toBeVisible();

    // -- EDIT 2nd GOAL ---
    const originalSecondText = WEEKLYGOAL_DB[1].text;
    const updatedText = 'Updated Integration Goal';
    const editInput = within(dialog).getByDisplayValue(originalSecondText);
    await user.clear(editInput);
    await user.type(editInput, updatedText);
    expect(within(dialog).getByText(/Editing 1/i)).toBeVisible();

    // --- ADD NEW GOAL ---
    const newGoalText = 'Brand New Goal';
    const goalInputs = within(dialog).getAllByPlaceholderText(/Enter your goal/i);
    expect(saveBtn).toBeDisabled();
    const lastInput = goalInputs[goalInputs.length - 1];
    await user.type(lastInput, newGoalText);

    // Click the last select box (through combobox role due to Angular Material wonkiness)
    // see: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/combobox_role
    const hashtagSelect = within(dialog).getAllByRole('combobox');
    await user.click(hashtagSelect[hashtagSelect.length - 1]);

    // Angular Material doesn't render the mat-select options in the mat-dialog, so we must use `screen`
    const options = await screen.findAllByRole('option');

    // Click the first option (doesn't matter which one we pick)
    const firstOption = options[0];

    // fireEvent must be used here due to mat-select's wonky implementation to
    // ensure the event triggered is the selection event we want specifically
    // see: https://testing-library.com/docs/user-event/intro/#differences-from-fireevent
    fireEvent.click(firstOption);

    fixture.detectChanges();
    await fixture.whenStable();

    // -- SAVE ---
    expect(saveBtn).not.toBeDisabled();
    await user.click(saveBtn);
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));

    // --- VERIFY ---
    expect(await screen.findByText(updatedText)).toBeVisible();
    expect(screen.getByText(newGoalText)).toBeVisible();

    // --- TOGGLE COMPLETION ---
    const checkbox = screen.getByRole('checkbox', { name: newGoalText });
    await user.click(checkbox);
    expect(await screen.findByText(/Marked goal as complete/i)).toBeVisible();

    const checkedCheckbox = screen.getByRole('checkbox', { name: 'Apply to OpenAI' });
    await user.click(checkedCheckbox);
    expect(await screen.findByText(/Marked goal as incomplete/i)).toBeVisible();
  }, 30000);

  it('handles rendering of no goals', async () => {
    // We create a one-off mock instance for this specific state
    const emptyDbMock = {
      getEntities: jest.fn().mockResolvedValue([]),
      afUser: jest.fn(),
    };

    await setup([
      { provide: DATABASE_SERVICE, useValue: emptyDbMock },
    ]);

    expect(await screen.findByText(/No weekly goals at the moment!/i)).toBeVisible();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('handles save failure: shows error and allows retry', async () => {
    const backendError = new Error('Backend Error');

    // Force batch write to always fail
    const failingBatchMock = {
      batchWrite: jest.fn().mockImplementation(() => {
        const p = Promise.reject(backendError);
        // Since promise will be rejected, prevent JSDOM from failing the test
        p.catch(() => {});
        return p;
      }),
    };

    // Spy on console.error()
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { user } = await setup([
      { provide: BATCH_WRITE_SERVICE, useValue: failingBatchMock },
    ]);

    // Open modal and make edits
    await user.click(await screen.findByLabelText('Desktop edit goals'));
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getAllByPlaceholderText(/Enter your goal/i)[0];
    await user.type(input, 'force change');

    const saveBtn = within(dialog).getByRole('button', { name: /Save/i });

    // This will trigger an error
    await user.click(saveBtn);

    // Make sure error was caught and modal is still open
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeVisible();
      expect(saveBtn).not.toBeDisabled();

      expect(consoleSpy).toHaveBeenCalledWith('Backend Error');

      expect(failingBatchMock.batchWrite).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          snackBarConfig: expect.objectContaining({
            failureMessage: 'Goals failed to update',
          }),
        }),
      );
    });

    consoleSpy.mockRestore();
  }, 15000);

  it('shows loading state while data is fetching', async () => {
    // Create a mock that returns a promise that never resolves
    const pendingDbMock = {
      getEntities: jest.fn().mockReturnValue(new Promise(() => {})),
      afUser: jest.fn(),
    };

    // Render with the pending mock
    await setup([
      { provide: DATABASE_SERVICE, useValue: pendingDbMock },
    ]);

    // Ensure the actual goal list is NOT rendered yet
    expect(screen.queryByText(/Weekly Goals/i)).not.toBeInTheDocument();
  });
});
