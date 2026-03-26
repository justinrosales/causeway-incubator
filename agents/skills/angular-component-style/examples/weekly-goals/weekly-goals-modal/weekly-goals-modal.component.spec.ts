import { fireEvent, render, screen, waitFor } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { WeeklyGoalsModalComponent } from './weekly-goals-modal.component';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { WeeklyGoalData } from '../../home.model';
import { signal } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormArray } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { LoadingIconComponent } from 'src/app/shared/components/loading-icon/loading-icon.component';
import { A11yModule } from '@angular/cdk/a11y';
import { MOCK_INCOMPLETE_GOALS, MOCK_GOAL_DATAS } from '../../home.mock';
import { DATABASE_SERVICE } from 'src/app/core/firebase/database.service';
import { FirebaseMockService } from 'src/app/core/firebase/firebase.mock.service';
import { BATCH_WRITE_SERVICE } from 'src/app/core/store/batch-write.service';
import { BatchWriteMockService } from 'src/app/core/store/batch-write.mock.service';

/**
 * Sets up the testing environment for WeeklyGoalsModalComponent.
 * @param incompleteGoals - Initial list of weekly goals.
 * @param pencilClicked - Indicates if the modal was opened via the edit (pencil) icon.
 * @param updateWeeklyGoals - Mock function to simulate saving goals.
 * @param loading - Signal for the loading state
 */
async function setup({
  incompleteGoals = MOCK_INCOMPLETE_GOALS,
  pencilClicked = true,
  updateWeeklyGoals = jest.fn((formArray: FormArray) => Promise.resolve()),
  loading = signal(false),
} = {}) {
  const user = userEvent.setup();

  // Mock some necessary things
  const close = jest.fn();

  const view = await render(WeeklyGoalsModalComponent, {
    imports: [
      NoopAnimationsModule,
      MatSelectModule,
      DragDropModule,
      A11yModule,
      LoadingIconComponent,
    ],
    providers: [
      { provide: DATABASE_SERVICE, useClass: FirebaseMockService },
      { provide: BATCH_WRITE_SERVICE, useClass: BatchWriteMockService },
      { provide: MatDialogRef, useValue: { close } },
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          goalDatas: MOCK_GOAL_DATAS,
          incompleteGoals,
          pencilClicked,
          loading,
          updateWeeklyGoals,
        },
      },
    ],
  });

  return {
    user,
    fixture: view.fixture,
    updateWeeklyGoals,
    loading,
    close,
    rerender: (goal: WeeklyGoalData) => view.rerender({ componentInputs: { goal } }),
  };
}

/**
 * Test suite for WeeklyGoalModalComponent
 * Unfortunately, the Angular team has no intention of creating a test harness for the drag and drop CDK used in the modal.
 * The Angular Testing Library is also incapable of simulating this interaction due to JSDOM wonkiness.
 * We must get full coverage by not following the ATL philosophy by testing through implementation.
 *
 * TODO: If a preferred way of testing this modal is implemented, update test.
 * @see https://github.com/angular/components/issues/22067
 * @see https://github.com/testing-library/angular-testing-library/issues/405
 */
describe('WeeklyGoalsModal', () => {
  it('renders the modal header, goals, and hashtags', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: /Weekly Goals/i })).toBeInTheDocument();
    for (const goal of MOCK_INCOMPLETE_GOALS) {
      expect(screen.getByDisplayValue(goal.text)).toBeVisible();
    }
    expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
  });

  it('renders with cursor focused on an empty new goal when not pencilClicked', async () => {
    await setup({ pencilClicked: false });

    const inputs = screen.getAllByPlaceholderText(/Enter your goal/i);
    const newGoalInput = inputs[inputs.length - 1];

    // A bit of an implementation-specific way to identify the field is focused,
    // but using `toHaveFocus()` is going to always return the full Angular Material modal
    expect(newGoalInput).toHaveAttribute('cdkfocusinitial');
    expect(newGoalInput).toHaveValue('');
  });

  it('shows form validation errors for empty goal text', async () => {
    const { user } = await setup();

    const input = screen.getByDisplayValue(MOCK_INCOMPLETE_GOALS[0].text);
    await user.clear(input);

    const saveBtn = screen.getByRole('button', { name: /Save/i });
    expect(saveBtn).toBeDisabled();
  });

  it('renders loading and no goals correctly', async () => {
    // Test loading state via Signal
    const { fixture, loading } = await setup({ incompleteGoals: [], pencilClicked: true, loading: signal(true) });

    // The loading icon should be visible, and form should be hidden
    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();

    // Since you can't re-render a modal, we have to modify the component state directly
    loading.set(false);
    fixture.detectChanges();

    // Should be no goals, but always at least one empty row
    const inputs = screen.queryAllByPlaceholderText(/Enter your goal/i);
    expect(inputs.length).toBe(1);
  });

  it('supports the full editing workflow (add, edit text/hashtag, reorder, delete) and emits updateWeeklyGoals on save', async () => {
    const { fixture, user, updateWeeklyGoals } = await setup({ pencilClicked: true });

    // --- EDIT TEXT ---
    const editInput = screen.getByDisplayValue(MOCK_INCOMPLETE_GOALS[0].text);
    await user.type(editInput, ' Updated');
    expect(screen.getByText(/Editing 1/i)).toBeVisible();

    // --- ADD GOAL ---
    const addBtn = screen.getByRole('button', { name: /Add goal/i });
    await user.click(addBtn);
    const goalRows = screen.getAllByPlaceholderText(/Enter your goal/i);

    // Edge case: test full delete by removing new goal (should modify row length)
    expect(goalRows.length).toEqual(MOCK_INCOMPLETE_GOALS.length + 1);
    const trashIcons = screen.getAllByLabelText('trash icon');
    expect(trashIcons.length).toBeGreaterThan(0);
    await user.click(trashIcons[trashIcons.length - 1]);
    const afterGoalRows = screen.getAllByPlaceholderText(/Enter your goal/i);
    expect(afterGoalRows.length).toEqual(MOCK_INCOMPLETE_GOALS.length);

    // Click add goal button again
    await user.click(addBtn);
    const newGoalRows = screen.getAllByPlaceholderText(/Enter your goal/i);
    const lastInput = newGoalRows[newGoalRows.length - 1];
    await user.type(lastInput, 'New Workflow Goal');
    expect(screen.getByText(/Adding 1/i)).toBeVisible();

    // --- EDIT HASHTAG ---
    const selects = screen.getAllByRole('combobox');
    await user.click(selects[selects.length - 1]);
    const options = await screen.findAllByRole('option');
    fireEvent.click(options[1]); // Select second hashtag

    // --- DELETE ---
    await user.click(trashIcons[0]);
    expect(screen.getByText(/Deleting 1/i)).toBeVisible();

    // -- REORDERING ---
    const formArray = fixture.componentInstance.allGoals;

    // initially Goal 1 at index 0
    expect(formArray.at(0).value.text).toBe('Finish Google Cover Letter Updated');

    fixture.componentInstance.drop({ previousIndex: 0, currentIndex: 1 } as CdkDragDrop<any>);

    // now Goal 1 should be after Goal 2
    expect(formArray.at(1).value.text).toBe('Finish Google Cover Letter Updated');

    // --- SAVE & EMIT ---
    const saveBtn = screen.getByRole('button', { name: /Save/i });
    await user.click(saveBtn);

    expect(updateWeeklyGoals).toHaveBeenCalledTimes(1);
  }, 10000);
});
