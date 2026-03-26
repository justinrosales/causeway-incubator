import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { WeeklyGoalItemComponent } from './weekly-goal-item.component';
import { DATABASE_SERVICE } from 'src/app/core/firebase/database.service';
import { FirebaseMockService } from 'src/app/core/firebase/firebase.mock.service';
import { BatchWriteMockService } from 'src/app/core/store/batch-write.mock.service';
import { BATCH_WRITE_SERVICE } from 'src/app/core/store/batch-write.service';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { WeeklyGoalData } from '../../home.model';
import { MOCK_GOAL } from '../../home.mock';

/**
 * Sets up the testing environment for WeeklyGoalItemComponent using render.
 * @param goal - The WeeklyGoal input to the component.
 */
async function setup(goal: WeeklyGoalData) {
  const user = userEvent.setup();
  const checkedSpy = jest.fn();
  const weeklyGoalClickedSpy = jest.fn();

  const view = await render(WeeklyGoalItemComponent, {
    imports: [MatCheckboxModule],
    providers: [
      { provide: DATABASE_SERVICE, useClass: FirebaseMockService },
      { provide: BATCH_WRITE_SERVICE, useClass: BatchWriteMockService },
    ],
    componentInputs: { goal },
    on: {
      checked: checkedSpy,
      weeklyGoalClicked: weeklyGoalClickedSpy,
    },
  });

  return {
    user,
    goal,
    fixture: view.fixture,
    checkedSpy,
    weeklyGoalClickedSpy,
    rerender: (goal: WeeklyGoalData) => view.rerender({ componentInputs: { goal } }),
  };
}

describe('WeeklyGoalItem', () => {
  it('renders and rerenders the weekly goal text and hashtag', async () => {
    const { goal, rerender } = await setup(MOCK_GOAL);

    expect(screen.getByText(goal.text)).toBeVisible();

    const hashtag = screen.getByText(`#${goal.hashtag.name}`);
    expect(hashtag).toBeVisible();

    await rerender({
      ...goal,
      text: 'Updated Goal Text',
      hashtag: { ...goal.hashtag, name: 'updated' },
    });

    expect(screen.getByText('Updated Goal Text')).toBeVisible();
    expect(screen.getByText('#updated')).toBeVisible();
  });

  it('renders and rerenders a completed and incomplete goal', async () => {
    const { goal, rerender } = await setup({
      ...MOCK_GOAL,
      completed: false,
    });

    const goalText = screen.getByText(goal.text);
    expect(goalText).toHaveStyle({ textDecoration: 'none' });

    await rerender({
      ...goal,
      completed: true,
    });

    expect(goalText).toHaveStyle({ textDecoration: 'line-through' });
  });

  it('renders loading and no hashtag states correctly', async () => {
    const { goal } = await setup({
      ...MOCK_GOAL,
      hashtag: undefined as any,
    });

    // Should be no hashtag
    expect(screen.getByText(goal.text)).toBeVisible();
    expect(screen.queryByText('#')).not.toBeInTheDocument();
  });

  it('emits checked, updates checkbox, and updates aria labels on toggle', async () => {
    const { user, goal, checkedSpy, rerender } = await setup({
      ...MOCK_GOAL,
      completed: false,
    });

    const checkbox = screen.getByRole('checkbox', {
      name: goal.text,
    }) as HTMLInputElement;

    // Check UI since component doesn't control state
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);

    expect(checkedSpy).toHaveBeenCalledTimes(1);
    expect(checkedSpy).toHaveBeenCalledWith(goal);
    expect(checkbox).toBeChecked();

    await rerender({
      ...goal,
      completed: true,
    });

    expect(checkbox).toBeChecked();
  });

  it('emits weeklyGoalClickedSpy on click', async () => {
    const { user, goal, weeklyGoalClickedSpy } = await setup(MOCK_GOAL);

    await user.click(screen.getByText(goal.text));

    expect(weeklyGoalClickedSpy).toHaveBeenCalledTimes(1);
  });
});
